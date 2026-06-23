-- ============================================================
--  Emissor NFS-e Maradel — Migration 0004
--  Motivo de cancelamento da solicitação (texto livre).
--  Preenchido pelo cliente ao cancelar, após confirmação.
--
--  Aditiva e idempotente. Rode no SQL Editor APÓS a 0001–0003.
--  Enquanto não rodar, o cancelamento funciona normalmente — apenas
--  o motivo não é gravado (o front degrada com elegância).
-- ============================================================

alter table public.solicitacoes
  add column if not exists motivo_cancelamento text;
