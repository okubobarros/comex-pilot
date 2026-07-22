# ETL — ingestão de dados

Pipeline de ingestão das fontes (planilhas/CSV) para o Postgres. Ver
[../../docs/data/ncm-tax-base.md](../../docs/data/ncm-tax-base.md).

## Disponível (Sprint 0)

- **`gen_seed_cosmetico.py`** — gera `seeds/0002_cosmetico.sql` a partir de
  `data/sources/*.csv` (piloto cosmético: 54 NCMs + tributos + anuência ANVISA).
  ```bash
  python scripts/etl/gen_seed_cosmetico.py
  ```
  Idempotente e reprodutível (lê CSVs versionados no repo).

## A construir (Sprint 1)

- `etl_ncm.py` — base NCM completa (15.161) do `Tabela_NCM_Vigente_*.xlsx`.
- `etl_tributos.py` — `ncm_tributo` da aba `Ctax` (10.520+).
- `etl_referencia.py` — `icms_uf`, `siscomex_taxa`, `cambio_ptax` (bootstrap).
- `sync_ptax.py` — sincroniza câmbio via API BCB Olinda (contínuo).

Princípios: upsert por chave natural, versionamento por vigência, normalização
(vírgula→ponto, `Sim/Não`→bool, `9999`→sentinela), log em `event_log`.
