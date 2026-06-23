-- ============================================================
--  Emissor NFS-e Maradel — Migration 0002
--  Mudanças:
--   - cadastro completo do cliente pelo analista (endereço + e-mail)
--   - e-mail opcional no tomador (para envio da nota)
--  Aditiva e idempotente. Rode no SQL Editor após a 0001.
-- ============================================================

-- clientes: dados completos preenchidos pelo analista no convite.
alter table public.clientes add column if not exists endereco text;
alter table public.clientes add column if not exists email    text;

-- tomadores: e-mail opcional usado no botão "Enviar por e-mail" da nota.
alter table public.tomadores add column if not exists email text;

-- ============================================================
--  FIM
-- ============================================================
