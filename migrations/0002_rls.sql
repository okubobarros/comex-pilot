-- ============================================================================
-- MCAT / ComexPilot — RLS + GRANTs (Sprint 0)
-- Schema `mcat` é novo: além do RLS (filtra linhas), os roles precisam de GRANT
-- (acesso à tabela/schema). Sem os dois, a API do Supabase dá "permission denied".
--
--   - REFERÊNCIA (dados fiscais públicos): grant SELECT + policy read para anon/authenticated.
--   - OPERACIONAL (processo/documento/decisao/...): RLS ligado, SEM grant para anon —
--     acesso só via backend (service_role). Policies multi-tenant entram depois.
--   - service_role: acesso total (backend via PostgREST) — bypassa RLS.
-- Idempotente. Alvo: Supabase (roles anon/authenticated/service_role existem).
-- ============================================================================

set search_path to mcat, public;

-- 0) Uso do schema
grant usage on schema mcat to anon, authenticated, service_role;

-- 1) Habilita RLS em todas as tabelas do schema mcat
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'mcat' loop
    execute format('alter table mcat.%I enable row level security', t);
  end loop;
end $$;

-- 2) Referência: grant SELECT + policy de leitura pública
do $$
declare
  t text;
  ref_tables text[] := array[
    'ncm','ncm_tributo','icms_uf','siscomex_taxa','cambio_ptax','afrmm_aliquota',
    'ibs_cbs_regra','aliquota_ibs_cbs','orgao_anuente','ncm_anuencia',
    'norma','norma_relacao','norma_chunk'
  ];
begin
  foreach t in array ref_tables loop
    execute format('grant select on mcat.%I to anon, authenticated', t);
    execute format('drop policy if exists ref_read on mcat.%I', t);
    execute format(
      'create policy ref_read on mcat.%I for select to anon, authenticated using (true)', t
    );
  end loop;
end $$;

-- 3) service_role: acesso total (backend). Objetos atuais + futuros.
grant all on all tables in schema mcat to service_role;
grant all on all sequences in schema mcat to service_role;
alter default privileges in schema mcat grant all on tables to service_role;
alter default privileges in schema mcat grant all on sequences to service_role;

-- 4) Operacionais (processo, documento, divergencia, decisao, event_log) ficam com
--    RLS ligado e SEM grant para anon/authenticated: só o backend acessa.
