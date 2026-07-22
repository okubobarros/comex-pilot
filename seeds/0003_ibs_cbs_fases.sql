-- ============================================================================
-- Fases da transição IBS/CBS 2027→2033 (para a "Time Machine" da UI).
-- A fase 2026 já está em 0001_static.sql (valores oficiais, LC 214/2025).
--
-- ⚠️ PROVISÓRIO: os percentuais de 2027+ são ILUSTRATIVOS (alíquota de referência
-- fixada por resolução do Senado/CGIBS, ainda a consolidar). A MECÂNICA é conhecida
-- (PIS/COFINS extintos em 2027, IPI zerado exceto ZFM, ICMS −10%/ano de 2029-2033,
-- IBS subindo na mesma proporção). NÃO usar estes números para decisão real até a
-- validação do tributarista. Ver docs/data/data-acquisition-checklist.md §3.2.
-- ============================================================================

set search_path to mcat, public;

insert into ibs_cbs_regra
  (vigencia_inicio, vigencia_fim, cbs_pct, ibs_pct, cbs_compensavel, ibs_compensavel, pis_cofins_ativo, ipi_zerado, base_legal)
values
  (date '2027-01-01', date '2028-12-31', 8.800,  0.100, false, false, false, true,
   'PROVISÓRIO — CBS cheia; PIS/COFINS extintos; IPI zerado (exceto ZFM). Alíquota de referência a confirmar'),
  (date '2029-01-01', date '2032-12-31', 8.800,  8.850, false, false, false, true,
   'PROVISÓRIO — transição: ICMS −10%/ano, IBS sobe na mesma proporção. Percentuais a confirmar'),
  (date '2033-01-01', date '9999-12-31', 8.800, 17.700, false, false, false, true,
   'PROVISÓRIO — regime definitivo (IBS/CBS pleno). Alíquota de referência a confirmar')
on conflict (vigencia_inicio) do nothing;
