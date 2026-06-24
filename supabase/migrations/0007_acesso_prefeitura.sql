-- ============================================================
--  Emissor NFS-e Maradel — Migration 0007
--  Dados de acesso à prefeitura no cadastro do cliente (Parte 3).
--   - link/portal de emissão, login/código de acesso e SENHA
--   - a senha é guardada CRIPTOGRAFADA (pgcrypto / pgp_sym_encrypt),
--     nunca em texto puro;
--   - tabela SEPARADA, visível apenas para a EQUIPE (o cliente nunca lê),
--     espelhando o padrão de solicitacao_interno;
--   - escrita só por ADMIN (master / operacional);
--   - a senha em claro só é devolvida a ANALISTA OU SUPERIOR (can_conferir),
--     via RPC SECURITY DEFINER — o cipher nunca precisa trafegar.
--   - indicador "emissão por procuração?" (sim/não), apenas informativo.
--
--  Aditiva e idempotente. Rode APÓS a 0006 (usa is_staff/is_admin/can_conferir).
--
--  PASSO MANUAL OBRIGATÓRIO (uma vez, antes de cadastrar senhas):
--    Defina a chave de criptografia simétrica no banco —
--      alter database postgres
--        set app.prefeitura_key = 'COLE-AQUI-UMA-CHAVE-LONGA-E-ALEATORIA';
--    (gere algo como: select encode(gen_random_bytes(32),'base64');)
--    Depois reconecte a sessão. Sem essa chave, salvar/ler senha falha
--    com mensagem clara — link e login continuam funcionando normalmente.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TABELA: cliente_prefeitura (1:1 com clientes) — só equipe acessa
-- ------------------------------------------------------------
create table if not exists public.cliente_prefeitura (
  cliente_id          uuid primary key references public.clientes(id) on delete cascade,
  link                text,                 -- portal/URL de emissão da prefeitura
  login               text,                 -- login ou código de acesso
  senha_cipher        bytea,                -- senha criptografada (pgp_sym_encrypt); nunca em claro
  emissao_procuracao  boolean not null default false,  -- usar acesso do escritório (sim) x do cliente (não)
  updated_at          timestamptz not null default now()
);

alter table public.cliente_prefeitura enable row level security;

-- Leitura: somente a equipe interna (o cliente NUNCA lê esta tabela). Mesmo
-- que leia, a senha está cifrada — inútil sem a chave (que vive no banco).
drop policy if exists cliente_pref_select on public.cliente_prefeitura;
create policy cliente_pref_select on public.cliente_prefeitura for select
  using ( public.is_staff() );

-- Escrita (inserir/alterar/remover): apenas ADMIN (master ou operacional).
-- A criptografia da senha é feita pelo RPC abaixo; a escrita direta da tabela
-- fica restrita ao admin como guarda extra (defesa em profundidade).
drop policy if exists cliente_pref_write on public.cliente_prefeitura;
create policy cliente_pref_write on public.cliente_prefeitura for all
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ------------------------------------------------------------
-- Chave de criptografia (lida de um GUC do banco, definido manualmente).
-- nullif('') => devolve null quando o GUC não está configurado.
-- ------------------------------------------------------------
create or replace function public._prefeitura_key()
returns text
language sql stable security definer set search_path = public as $$
  select nullif(current_setting('app.prefeitura_key', true), '');
$$;

-- ------------------------------------------------------------
-- set_cliente_prefeitura(): grava/atualiza os dados de acesso.
--   Só ADMIN (master/operacional). A senha é criptografada aqui.
--   Semântica da senha (p_senha):
--     - null            => mantém a senha já cadastrada (edita link/login sem retipar)
--     - ''  (vazia)     => remove a senha
--     - texto           => criptografa e substitui
-- ------------------------------------------------------------
create or replace function public.set_cliente_prefeitura(
  p_cliente_id  uuid,
  p_link        text,
  p_login       text,
  p_senha       text,
  p_procuracao  boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  k           text;
  novo_cipher bytea;
begin
  if not public.is_admin() then
    raise exception 'Apenas master ou admin operacional pode editar os dados de acesso da prefeitura.'
      using errcode = '42501';
  end if;

  k := public._prefeitura_key();

  if p_senha is null then
    -- mantém o que já existe
    select senha_cipher into novo_cipher
      from public.cliente_prefeitura where cliente_id = p_cliente_id;
  elsif length(btrim(p_senha)) = 0 then
    novo_cipher := null;                       -- limpar a senha
  else
    if k is null then
      raise exception 'Chave de criptografia (app.prefeitura_key) não configurada. Veja o passo manual da migration 0007.'
        using errcode = '55000';
    end if;
    novo_cipher := pgp_sym_encrypt(p_senha, k);
  end if;

  insert into public.cliente_prefeitura
      (cliente_id, link, login, senha_cipher, emissao_procuracao, updated_at)
  values
      (p_cliente_id, nullif(btrim(p_link),''), nullif(btrim(p_login),''),
       novo_cipher, coalesce(p_procuracao, false), now())
  on conflict (cliente_id) do update
    set link               = excluded.link,
        login              = excluded.login,
        senha_cipher       = excluded.senha_cipher,
        emissao_procuracao = excluded.emissao_procuracao,
        updated_at         = now();
end;
$$;

-- ------------------------------------------------------------
-- get_cliente_prefeitura(): metadados de acesso para a EQUIPE.
--   Não devolve o cipher; apenas se existe senha (tem_senha).
-- ------------------------------------------------------------
create or replace function public.get_cliente_prefeitura(p_cliente_id uuid)
returns table(link text, login text, emissao_procuracao boolean, tem_senha boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
    select cp.link, cp.login, cp.emissao_procuracao, (cp.senha_cipher is not null)
      from public.cliente_prefeitura cp
     where cp.cliente_id = p_cliente_id;
end;
$$;

-- ------------------------------------------------------------
-- get_cliente_prefeitura_senha(): devolve a senha EM CLARO.
--   Restrito a ANALISTA OU SUPERIOR (can_conferir). Auxiliar é barrado.
-- ------------------------------------------------------------
create or replace function public.get_cliente_prefeitura_senha(p_cliente_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  k text;
  c bytea;
begin
  if not public.can_conferir() then
    raise exception 'Apenas analista ou superior pode ver a senha da prefeitura.'
      using errcode = '42501';
  end if;
  select senha_cipher into c
    from public.cliente_prefeitura where cliente_id = p_cliente_id;
  if c is null then
    return null;
  end if;
  k := public._prefeitura_key();
  if k is null then
    raise exception 'Chave de criptografia (app.prefeitura_key) não configurada. Veja o passo manual da migration 0007.'
      using errcode = '55000';
  end if;
  return pgp_sym_decrypt(c, k);
end;
$$;

-- ============================================================
--  FIM — lembre do PASSO MANUAL (app.prefeitura_key) descrito no topo.
-- ============================================================
