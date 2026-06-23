-- ============================================================
--  Emissor NFS-e Maradel — Migration 0003
--  Evolução do app:
--   B) número de pedido + bloqueio real de emissão
--   C) recorrência (informativo)
--   D) página pública da nota (token aleatório + expiração 90d)
--   E) telefone/grupo de WhatsApp no cliente (prestador)
--   F) histórico de envios e aberturas (tabela nota_eventos)
--
--  Aditiva e idempotente. Rode no SQL Editor APÓS a 0001 e 0002.
-- ============================================================

create extension if not exists pgcrypto;  -- gen_random_bytes / gen_random_uuid

-- ------------------------------------------------------------
-- B) SOLICITAÇÕES: número de pedido
-- C) SOLICITAÇÕES: recorrência (apenas informativo, sem automação)
-- ------------------------------------------------------------
alter table public.solicitacoes add column if not exists numero_pedido    text;
alter table public.solicitacoes add column if not exists recorrente       boolean not null default false;
alter table public.solicitacoes add column if not exists recorrencia_meses integer;

-- ------------------------------------------------------------
-- B) TOMADORES: exige número de pedido? (sim/não)
-- ------------------------------------------------------------
alter table public.tomadores add column if not exists exige_numero_pedido boolean not null default false;

-- ------------------------------------------------------------
-- E) CLIENTES (prestador): telefone (WhatsApp) e link de grupo
-- ------------------------------------------------------------
alter table public.clientes add column if not exists telefone       text;  -- só dígitos, com DDI/DDD (ex.: 5511999998888)
alter table public.clientes add column if not exists whatsapp_grupo text;  -- link chat.whatsapp.com/...

-- ------------------------------------------------------------
-- D) NOTAS: token público + expiração do link
-- ------------------------------------------------------------
alter table public.notas add column if not exists public_token   text;
alter table public.notas add column if not exists token_expira_em timestamptz;
-- O token é único; índice parcial ignora linhas antigas ainda sem token.
create unique index if not exists uq_notas_public_token
  on public.notas(public_token) where public_token is not null;

-- ============================================================
--  FUNÇÕES
-- ============================================================

-- gen_nota_token(): gera um token criptograficamente forte e amigável,
-- no formato 'maradel-<24 chars base64url>' (~144 bits de entropia).
-- Usado tanto no e-mail (atrás de uma âncora) quanto no WhatsApp (URL crua).
create or replace function public.gen_nota_token()
returns text
language sql volatile
as $$
  -- 18 bytes aleatórios (144 bits) em base64url (sem padding): 24 chars URL-safe.
  select 'maradel-' || translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

-- notas_set_token(): antes de inserir/atualizar uma nota, garante que ela
-- tenha um token e uma data de expiração (90 dias após a emissão). Só preenche
-- quando estiver vazio — assim a regeneração explícita não é sobrescrita, e
-- re-emitir a mesma nota preserva o link já divulgado.
create or replace function public.notas_set_token()
returns trigger
language plpgsql
as $$
begin
  if new.public_token is null then
    new.public_token := public.gen_nota_token();
  end if;
  if new.token_expira_em is null then
    new.token_expira_em := (coalesce(new.data_emissao, current_date) + interval '90 days');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notas_token on public.notas;
create trigger trg_notas_token
  before insert or update on public.notas
  for each row execute function public.notas_set_token();

-- check_numero_pedido(): BLOQUEIO REAL de emissão. Antes de gravar a nota,
-- se o tomador exige número de pedido e a solicitação não tem um preenchido,
-- a operação falha — o analista não consegue emitir até preencher. É a guarda
-- de servidor que acompanha o aviso visual da interface (item B).
create or replace function public.check_numero_pedido()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  exige boolean;
  ped   text;
begin
  select t.exige_numero_pedido, s.numero_pedido
    into exige, ped
  from public.solicitacoes s
  join public.tomadores t on t.id = s.tomador_id
  where s.id = new.solicitacao_id;

  if coalesce(exige, false) and coalesce(btrim(ped), '') = '' then
    raise exception 'Número de pedido obrigatório para este tomador. Preencha o número antes de emitir.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notas_check_pedido on public.notas;
create trigger trg_notas_check_pedido
  before insert or update on public.notas
  for each row execute function public.check_numero_pedido();

-- regenerar_token_nota(): gera um novo link público para a nota e renova a
-- expiração (+90 dias). Pode ser chamada pelo analista ou pelo dono da nota
-- (cliente prestador). SECURITY DEFINER faz a checagem de permissão por dentro.
create or replace function public.regenerar_token_nota(p_nota_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  novo text;
  pode boolean;
begin
  select public.is_analista()
      or exists (
        select 1
        from public.notas n
        join public.solicitacoes s on s.id = n.solicitacao_id
        join public.clientes c     on c.id = s.cliente_id
        where n.id = p_nota_id and c.user_id = auth.uid()
      )
    into pode;

  if not coalesce(pode, false) then
    raise exception 'Sem permissão para regenerar o link desta nota.' using errcode = '42501';
  end if;

  novo := public.gen_nota_token();
  update public.notas
     set public_token    = novo,
         token_expira_em  = now() + interval '90 days'
   where id = p_nota_id;
  return novo;
end;
$$;

-- ------------------------------------------------------------
-- F) HISTÓRICO: envios (e-mail/WhatsApp) e aberturas do link público
-- ------------------------------------------------------------
create table if not exists public.nota_eventos (
  id            bigint generated by default as identity primary key,
  nota_id       uuid not null references public.notas(id) on delete cascade,
  tipo          text not null check (tipo in ('envio','abertura')),
  canal         text,            -- 'email' | 'whatsapp' (envio) | null (abertura)
  destinatario  text,            -- e-mail ou telefone (envio)
  disparado_por uuid,            -- auth.uid de quem enviou (null na abertura)
  user_agent    text,            -- navegador de quem abriu (abertura)
  created_at    timestamptz not null default now()
);
create index if not exists idx_nota_eventos_nota on public.nota_eventos(nota_id, created_at desc);

-- ============================================================
--  RLS — nota_eventos
-- ============================================================
alter table public.nota_eventos enable row level security;

-- Leitura: analista, ou o cliente dono da nota (vê o histórico da própria nota).
drop policy if exists nota_eventos_select on public.nota_eventos;
create policy nota_eventos_select on public.nota_eventos for select
  using (
    public.is_analista()
    or nota_id in (
      select n.id from public.notas n
      join public.solicitacoes s on s.id = n.solicitacao_id
      join public.clientes c     on c.id = s.cliente_id
      where c.user_id = auth.uid()
    )
  );

-- Inserção de ENVIO: feita pelo app autenticado (analista ou dono da nota).
-- A abertura (tipo='abertura') NÃO entra por aqui — é gravada pela Edge Function
-- com service_role, que ignora a RLS. Por isso restringimos a 'envio'.
drop policy if exists nota_eventos_insert_envio on public.nota_eventos;
create policy nota_eventos_insert_envio on public.nota_eventos for insert
  with check (
    tipo = 'envio'
    and disparado_por = auth.uid()
    and (
      public.is_analista()
      or nota_id in (
        select n.id from public.notas n
        join public.solicitacoes s on s.id = n.solicitacao_id
        join public.clientes c     on c.id = s.cliente_id
        where c.user_id = auth.uid()
      )
    )
  );

-- ============================================================
--  BACKFILL — notas já emitidas antes desta migration
--  Recebem um token e uma expiração de 90 dias a partir da emissão.
-- ============================================================
update public.notas
   set public_token    = public.gen_nota_token()
 where public_token is null;

update public.notas
   set token_expira_em = (coalesce(data_emissao, current_date) + interval '90 days')
 where token_expira_em is null;

-- ============================================================
--  FIM
-- ============================================================
