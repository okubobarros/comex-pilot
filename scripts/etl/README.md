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

## Disponível (Sprint 1)

- **`load_reference.py`** — carrega a base de referência completa no schema `mcat`, direto no
  Postgres via `DATABASE_URL` (idempotente). Fontes em `data/sources/`:
  `ncm` (15.156) · `ncm_tributo` (10.512 — aba **`tax`**, não `Ctax`) · `icms_uf` (27) ·
  `siscomex_taxa` (523) · `cambio_ptax` (bootstrap).
  ```bash
  export DATABASE_URL="postgres://...supabase...:5432/postgres"   # ligação direta
  python scripts/etl/load_reference.py
  ```
  Requer `psycopg[binary]` e `openpyxl`. Validado ponta a ponta em pgvector pg16.

## A construir (próximo)

- `sync_ptax.py` — sincroniza câmbio via API BCB Olinda (contínuo).
- `etl_anuencia.py` — expande `ncm_anuencia` além do cosmético (parsing de tratamentos por segmento).

Princípios: upsert por chave natural, versionamento por vigência, normalização
(vírgula→ponto, `Sim/Não`→bool, `9999`→sentinela), log em `event_log`.
