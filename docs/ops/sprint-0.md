# Sprint 0 — fundação (entregue)

Schema + seeds do piloto cosmético, prontos para aplicar. **Validado num Postgres
pgvector (pg16) real:** migration e seeds aplicam sem erro; contagens e JOINs conferem.

## O que foi criado

```
migrations/0001_init.sql        # schema das 5 camadas (docs/architecture/data-model.md)
seeds/0001_static.sql           # órgãos anuentes, AFRMM por modal, regra IBS/CBS 2026, normas-âncora
seeds/0002_cosmetico.sql        # GERADO: 54 NCMs cap.33 + tributos + anuência ANVISA
scripts/etl/gen_seed_cosmetico.py  # gerador do seed cosmético (reprodutível)
data/sources/*.csv              # CSVs-fonte do piloto (versionados)
.env.example                    # variáveis do backend (sem segredos)
```

## Como aplicar (você executa — eu não me conecto ao seu banco)

Ordem importa: **migration → static → cosmetico** (o seed cosmético referencia
`orgao_anuente` do static).

**Opção A — psql / connection string:**
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seeds/0001_static.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seeds/0002_cosmetico.sql
```

**Opção B — Supabase CLI:** mover os `.sql` para `supabase/migrations/` e `supabase db push`.

Tudo é idempotente (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) — reaplicar não duplica.

## ⚠️ Antes de usar o Supabase existente (projeto do fluxo legado)

O projeto escolhido é o mesmo do fluxo n8n antigo (`cpzjxgcekxyunktmcmay`). Antes:

1. **Revisar/limpar objetos legados** (tabelas/RPC como `log_agent_usage`) que não fazem
   parte deste schema, para evitar colisão.
2. Confirmar que **pgvector** está habilitado (`create extension vector;` — Supabase suporta).
3. As migrations criam tudo no schema `public`; ajuste se seu projeto usa outro.

## Como validei (evidência)

Container `pgvector/pgvector:pg16` descartável, aplicando os 3 arquivos com
`ON_ERROR_STOP=1`. Resultado:

| tabela | linhas |
|---|---|
| ncm | 54 |
| ncm_tributo | 54 |
| ncm_anuencia | 54 |
| orgao_anuente | 7 |
| ibs_cbs_regra | 1 |
| afrmm_aliquota | 3 |
| norma | 6 |

JOIN de sanidade `3304.99.90` → II 18 / IPI 14,3 / PIS 2,1 / COFINS 9,65 · ANVISA ·
"RDC 16/2014, 752/2022, 949/2024, 907/2024". Coluna gerada `codigo_norm` = `33049990`.
Reaplicar o seed manteve 54 linhas (idempotência OK).

## Próximo (Sprint 1)

ETL da base NCM completa + tributos + referência (icms/siscomex/câmbio), e sincronização
PTAX via API BCB. Ver [../roadmap/sprints.md](../roadmap/sprints.md) e [../data/ncm-tax-base.md](../data/ncm-tax-base.md).
