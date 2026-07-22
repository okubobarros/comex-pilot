# Sprint 1 — ingestão da base real (parcial)

ETL das tabelas de referência para o schema `mcat`, **validado ponta a ponta** num Postgres
pgvector (pg16) real (aplica migrations → roda ETL → confere contagens, FKs, RLS, idempotência).

## O que foi criado

```
scripts/etl/load_reference.py   # carrega ncm, ncm_tributo, icms_uf, siscomex_taxa, cambio_ptax
data/sources/ncm_vigente.xlsx   # base NCM oficial (versionada)
data/sources/tax_calc.xlsx      # tributos/icms/siscomex/câmbio (versionada)
```

## Resultado da carga (validado)

| tabela | linhas | nota |
|---|---|---|
| ncm | 15.156 | base completa (cap. → item) |
| ncm_tributo | 10.512 | aba **`tax`** (100% com II); a `Ctax` está vazia |
| icms_uf | 27 | vírgula decimal normalizada (BA 20,50 → 20.50) |
| siscomex_taxa | 523 | por nº de adições |
| cambio_ptax | 5 | **só bootstrap** — produção via API BCB (a planilha só tinha 5 dias com cotação) |

Integridade: 0 tributos órfãos (FK ok); `3304.99.90` → II 18 / IPI 14,3 / PIS 2,1 / COFINS 9,65;
anon lê `ncm` (RLS+grant); reaplicar o ETL não duplica (idempotente).

## Como rodar (você executa — não me conecto ao seu banco)

1. Instale as libs:
   ```bash
   pip install "psycopg[binary]" openpyxl
   ```
2. Pegue a **connection string direta** do Supabase (Settings → Database → Connection string →
   `URI`, modo *session*; a porta 5432, não o pooler 6543 para ETL):
   ```bash
   export DATABASE_URL="postgres://postgres:[SENHA]@db.[SEU-PROJETO-REF].supabase.co:5432/postgres"
   ```
3. Rode:
   ```bash
   python scripts/etl/load_reference.py
   ```

O script faz `set search_path to mcat` e upsert idempotente — pode rodar de novo sem duplicar.

## Correção importante desta sprint

A análise da Sprint 0 preferiu a aba `Ctax` para tributos — **errado**: a `Ctax` está 98% vazia
(só ~378 de 14.892 linhas com II). A fonte correta é a aba **`tax`** (10.519 linhas, 100% com II).
Docs corrigidos: [../data/ncm-tax-base.md](../data/ncm-tax-base.md), checklist e migration.

## Pendências da Sprint 1

- **PTAX contínuo:** `sync_ptax.py` (API BCB Olinda) — o `cambio_ptax` hoje só tem o bootstrap.
- **Anuência além do cosmético:** parsing de `Tratamentos Administrativos` por segmento.
- **event_log:** registrar cada carga (origem, contagem, checksum).
