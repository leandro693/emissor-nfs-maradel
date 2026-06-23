-- ============================================================
--  Emissor NFS-e Maradel — Migration 0006
--  Hierarquia de permissões, fluxo de conferência, rastreamento
--  interno e contato de atendimento institucional.
--
--  Rode DEPOIS da 0005 (que adiciona os valores de enum usados aqui).
--  Aditiva e idempotente. Mantém tudo que já funcionava.
-- ============================================================

-- ============================================================
--  1. PAPÉIS — funções auxiliares de permissão
--  Todas SECURITY DEFINER + search_path fixo (evita recursão de RLS).
-- ============================================================

-- Papel do usuário logado.
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Membro da equipe interna (qualquer papel que não seja 'cliente').
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin_master','admin_operacional','analista','auxiliar');
$$;

-- Administradores (master ou operacional) — gerenciam o dia a dia.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin_master','admin_operacional');
$$;

-- Apenas o master — ações exclusivas (excluir usuários/clientes/notas, configs críticas).
create or replace function public.is_master()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin_master';
$$;

-- Quem pode conferir/liberar a emissão (analista ou superior). O auxiliar NÃO.
create or replace function public.can_conferir()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin_master','admin_operacional','analista');
$$;

-- Redefine is_analista() como "qualquer membro da equipe". Assim TODAS as
-- policies já existentes (clientes, tomadores, solicitacoes, storage, notas,
-- nota_eventos) passam a valer para os novos papéis internos sem reescrita.
-- As restrições mais finas (excluir, liberar emissão) vêm das policies/trigger
-- abaixo, que usam is_master()/can_conferir().
create or replace function public.is_analista()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff();
$$;

-- ============================================================
--  2. RESTRIÇÕES EXCLUSIVAS DO MASTER (exclusões)
--  Trocamos as policies FOR ALL por policies por comando, para poder
--  limitar o DELETE sem afetar select/insert/update.
-- ============================================================

-- ---- clientes: excluir só master; demais ações, equipe ou dono ----
drop policy if exists clientes_rw on public.clientes;
drop policy if exists clientes_select on public.clientes;
drop policy if exists clientes_insert on public.clientes;
drop policy if exists clientes_update on public.clientes;
drop policy if exists clientes_delete on public.clientes;
create policy clientes_select on public.clientes for select
  using ( public.is_staff() or user_id = auth.uid() );
create policy clientes_insert on public.clientes for insert
  with check ( public.is_staff() or user_id = auth.uid() );
create policy clientes_update on public.clientes for update
  using ( public.is_staff() or user_id = auth.uid() )
  with check ( public.is_staff() or user_id = auth.uid() );
create policy clientes_delete on public.clientes for delete
  using ( public.is_master() );

-- ---- notas: preparar/emitir = equipe; excluir = só master ----
drop policy if exists notas_write on public.notas;
drop policy if exists notas_insert on public.notas;
drop policy if exists notas_update on public.notas;
drop policy if exists notas_delete on public.notas;
create policy notas_insert on public.notas for insert
  with check ( public.is_staff() );
create policy notas_update on public.notas for update
  using ( public.is_staff() )
  with check ( public.is_staff() );
create policy notas_delete on public.notas for delete
  using ( public.is_master() );
-- notas_select (dono ou equipe) permanece da 0001.

-- ============================================================
--  3. GESTÃO DE EQUIPE — só master cadastra/exclui usuários
--  A criação real (auth + convite) é feita pela Edge Function
--  invite-equipe (service_role). Aqui garantimos que o app só
--  permita ao master alterar o PAPEL de outros perfis.
-- ============================================================

-- profiles_update da 0001 deixa cada um editar o PRÓPRIO perfil. Mantemos isso
-- e adicionamos: o master pode editar qualquer perfil (ex.: trocar papel).
drop policy if exists profiles_update_master on public.profiles;
create policy profiles_update_master on public.profiles for update
  using ( public.is_master() ) with check ( public.is_master() );

-- ============================================================
--  4. FLUXO DE CONFERÊNCIA — trava de liberação da emissão
--  Auxiliar prepara e envia para conferência (status
--  'aguardando_conferencia'); só analista+ libera (status 'emitida').
-- ============================================================
create or replace function public.guard_emissao()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Liberar a emissão (qualquer status -> 'emitida') exige conferência:
  -- apenas analista ou superior pode. O auxiliar é barrado aqui.
  if new.status = 'emitida' and old.status is distinct from 'emitida' then
    if not public.can_conferir() then
      raise exception 'Apenas analista ou superior pode liberar a emissão.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solic_guard_emissao on public.solicitacoes;
create trigger trg_solic_guard_emissao
  before update on public.solicitacoes
  for each row execute function public.guard_emissao();

-- ============================================================
--  5. RASTREAMENTO INTERNO — quem preparou e quem conferiu cada nota
--  Tabela SEPARADA e VISÍVEL APENAS PARA A EQUIPE. O cliente NUNCA lê
--  esta tabela (por isso não fica em solicitacoes/notas, que o cliente lê).
-- ============================================================
create table if not exists public.solicitacao_interno (
  solicitacao_id     uuid primary key references public.solicitacoes(id) on delete cascade,
  preparada_por      uuid references auth.users(id),
  preparada_por_nome text,                 -- nome no momento da ação (denormalizado)
  preparada_em       timestamptz,
  conferida_por      uuid references auth.users(id),
  conferida_por_nome text,
  conferida_em       timestamptz,
  observacao         text,                 -- devolução da conferência ao auxiliar
  updated_at         timestamptz not null default now()
);

alter table public.solicitacao_interno enable row level security;

-- Somente a equipe interna acessa (cliente sem qualquer acesso).
drop policy if exists solic_interno_rw on public.solicitacao_interno;
create policy solic_interno_rw on public.solicitacao_interno for all
  using ( public.is_staff() )
  with check ( public.is_staff() );

-- ============================================================
--  6. CONTATO DE ATENDIMENTO (institucional, visível ao cliente)
--  Singleton (id=1). Lido por qualquer usuário logado; editado por admin.
-- ============================================================
create table if not exists public.config_atendimento (
  id         int primary key default 1 check (id = 1),
  nome       text,
  whatsapp   text,                          -- só dígitos com DDI/DDD (ex.: 5511942722105)
  email      text,
  updated_at timestamptz not null default now()
);

-- Valores iniciais pedidos: Gabriela · (11) 94272-2105 · e-mail em branco.
insert into public.config_atendimento (id, nome, whatsapp, email)
values (1, 'Gabriela', '5511942722105', null)
on conflict (id) do nothing;

alter table public.config_atendimento enable row level security;

-- Leitura: qualquer usuário autenticado (o cliente precisa ver o contato).
drop policy if exists config_at_select on public.config_atendimento;
create policy config_at_select on public.config_atendimento for select
  using ( auth.uid() is not null );

-- Edição: administradores (master ou operacional).
drop policy if exists config_at_update on public.config_atendimento;
create policy config_at_update on public.config_atendimento for update
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ============================================================
--  FIM — lembre de promover seu usuário a admin_master:
--    update public.profiles set role = 'admin_master'
--      where email = 'SEU-EMAIL-AQUI';
-- ============================================================
