-- ============================================================
--  Emissor NFS-e Maradel — Migration 0005
--  Novos valores de ENUM: papéis da equipe + status de conferência.
--
--  IMPORTANTE: rode ESTE arquivo SOZINHO e ANTES da 0006.
--  O Postgres não deixa usar um valor de enum recém-criado na MESMA
--  transação em que ele foi adicionado; por isso os ADD VALUE ficam
--  isolados aqui. Depois de rodar a 0005, rode a 0006.
-- ============================================================

-- Hierarquia de papéis (do maior para o menor):
--   admin_master > admin_operacional > analista > auxiliar  (e 'cliente' externo)
alter type public.user_role add value if not exists 'admin_master';
alter type public.user_role add value if not exists 'admin_operacional';
alter type public.user_role add value if not exists 'auxiliar';

-- Fluxo de conferência: trabalho do auxiliar aguarda liberação do analista.
alter type public.solicitacao_status add value if not exists 'aguardando_conferencia';
