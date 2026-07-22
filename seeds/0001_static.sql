-- ============================================================================
-- Seeds estáticos (dados confirmados) — Sprint 0
-- Idempotente via ON CONFLICT.
-- ============================================================================

set search_path to mcat, public;

-- Órgãos anuentes (fonte: aba consulta do tax_calc + app)
insert into orgao_anuente (nome, tipo_exigencia) values
  ('ANVISA',  'Sanitário'),
  ('MAPA',    'Agropecuário'),
  ('IBAMA',   'Ambiental'),
  ('INMETRO', 'Metrologia/certificação'),
  ('ANATEL',  'Telecomunicações'),
  ('DECEX',   'Comercial'),
  ('SUFRAMA', 'Zona Franca')
on conflict (nome) do nothing;

-- AFRMM por modal (Receita Federal — confirmado em docs/data/incoming-artifacts-analysis.md)
insert into afrmm_aliquota (modal, aliquota_pct, base_legal) values
  ('longo_curso',                 25.0, 'Lei 10.893/2004 — navegação de longo curso'),
  ('cabotagem',                   10.0, 'Lei 10.893/2004 — cabotagem'),
  ('fluvial_lacustre_granel_nne', 40.0, 'Lei 10.893/2004 — fluvial/lacustre, granéis líquidos N/NE')
on conflict (modal) do nothing;

-- Regra IBS/CBS — fase 2026 (confirmado: LC 214/2025 art. 348, I; base Decreto 12.955/2026 art. 13)
insert into ibs_cbs_regra
  (vigencia_inicio, vigencia_fim, cbs_pct, ibs_pct, cbs_compensavel, ibs_compensavel, pis_cofins_ativo, ipi_zerado, base_legal)
values
  (date '2026-01-01', date '2026-12-31', 0.900, 0.100, true, true, true, false,
   'LC 214/2025 art. 348, I — CBS 0,9% + IBS 0,1% compensáveis com PIS/COFINS')
on conflict (vigencia_inicio) do nothing;
-- NOTA: fases 2027→2033 dependem dos percentuais a serem consolidados pelo tributarista
-- (ver docs/data/data-acquisition-checklist.md §3.2). Não semeadas para não fixar números incertos.

-- Norma-âncora do piloto (para citação/RAG). Textos integrais recebidos: LC 214/2025, RDC 907/2024.
insert into norma (tipo, orgao_emissor, identificacao, ementa, vigencia_inicio) values
  ('Lei Complementar', 'Congresso Nacional', 'LC 214/2025', 'Institui o IBS, a CBS e o Imposto Seletivo', date '2025-01-16'),
  ('RDC', 'ANVISA', 'RDC 907/2024', 'Definição, classificação, rotulagem e regularização de cosméticos, higiene pessoal e perfumes', date '2024-01-01'),
  ('RDC', 'ANVISA', 'RDC 752/2022', 'Norma-base de cosméticos (definição e classificação)', date '2022-01-01'),
  ('RDC', 'ANVISA', 'RDC 16/2014', 'Autorização de Funcionamento de Empresa (AFE)', date '2014-01-01'),
  ('RDC', 'ANVISA', 'RDC 949/2024', 'Cosméticos Grau 1 e Grau 2', date '2024-01-01'),
  ('Decreto', 'Executivo', 'Decreto 12.955/2026', 'Regulamenta a CBS (base de cálculo, art. 13)', date '2026-01-01')
on conflict (identificacao) do nothing;
