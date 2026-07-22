# Base NCM e tributos — estrutura e ingestão

_Mapeia os arquivos-fonte reais para as tabelas de [../architecture/data-model.md](../architecture/data-model.md)
e descreve o pipeline de ingestão._

## Arquivos-fonte

| Arquivo | Conteúdo | Vira tabela |
|---|---|---|
| `Tabela_NCM_Vigente_20260721.xlsx` → aba `Tabela NCM` | 15.161 códigos hierárquicos | `ncm` |
| `tax_calc.xlsx` → aba **`tax`** | Tributos federais por NCM (10.519 linhas, 100% com II) | `ncm_tributo` (+ semente de `ncm_anuencia`) |
| `tax_calc.xlsx` → aba `icms` | ICMS/AFRMM por UF (27) | `icms_uf` |
| `tax_calc.xlsx` → aba `siscomex` | Taxa por nº de adições | `siscomex_taxa` |
| `tax_calc.xlsx` → aba `exchange_rate` | Câmbio diário USD/EUR | `cambio_ptax` |
| `tax_calc.xlsx` → aba `consulta` | URLs de referência + lista de anuentes | seed de `orgao_anuente` + doc de fontes |

## Estrutura real observada (headers)

**`Tabela NCM`** (dados começam na linha 6; header na linha 5):
`Código | Descrição | Data Início | Data Fim | Ato Legal Início | Número | Ano`
- Hierarquia pelo formato do código: `01` (cap., 2díg) → `01.01` (posição) → `0101.2` (subpos.) →
  `0101.21.00` (item 8díg). O `nivel` e o `parent_codigo` derivam do número de dígitos.
- `Data Fim = 31/12/9999` é sentinela de "vigente" → mapear para `vigencia_fim`.

**`tax`** (⚠️ usar esta, NÃO a `Ctax` — a `Ctax` está 98% vazia; verificado na Sprint 1):
`Código | Código2 | Descrição Concatenada | Descrição | II(%) | IPI(%) | PIS(%) | COFINS(%) | CIDE | Antidumping | Medidas Compensatórias | Tratamentos Administrativos`
(II na coluna índice 4; o código com pontos está na coluna 0)
- `Sim/Não` → boolean.
- `Tratamentos Administrativos` é texto longo com anuências (ex.: "Mercadoria sujeita à anuência
  de…") → **fonte para popular `ncm_anuencia`** via parsing por palavra-chave (ANVISA, MAPA, IBAMA…).

**`icms`**: `UF | Estado | ICMS | AFRMM | taxa_utilizacao_MM` — ⚠️ BA vem como `20,50` (vírgula);
normalizar para ponto no ETL.

**`siscomex`**: `qtde_adicoes_di | valor_por_adicao | valor_total_taxa_siscomex | valor_item_siscomex`.

**`exchange_rate`**: `Data | USD/BRL | EUR/BRL` — há linhas de data sem cotação (dias sem PTAX);
ignorar nulos na carga.

**`consulta`** confirma os anuentes a semear: SUFRAMA, DECEX, ANVISA, MAPA, INMETRO, IBAMA (+ ANATEL
já usado no app).

## Pipeline de ingestão (idempotente e versionado)

```
xlsx  ──parse──►  staging (jsonb bruto)  ──normalize──►  upsert em tabela final  ──►  event_log
```

Regras do ETL:
1. **Idempotência:** `upsert` por chave natural (`ncm.codigo`, `ncm_tributo(ncm,vigencia_inicio)`),
   nunca `truncate+insert`.
2. **Versionamento:** ao reingerir tributos com valores diferentes, **fechar** a linha vigente
   (`vigencia_fim = ontem`) e inserir a nova — preserva histórico para o motor consultar por data.
3. **Normalização:** vírgula→ponto em decimais; `Sim/Não`→bool; `31/12/9999`→sentinela;
   código NCM guardado nos dois formatos (`3304.99.90` e `33049990`).
4. **Anuência:** regex no campo `Tratamentos Administrativos` para gerar `ncm_anuencia`
   (curadoria manual valida o resultado por segmento — cosmético primeiro).
5. **Auditoria:** cada carga registra origem, contagem e checksum em `event_log`.

Local sugerido do script: `scripts/etl/` (Node ou Python). Rodar via comando único
(`npm run etl:ncm` / `etl:tax`), lendo os `.xlsx` de um diretório configurável.

## Recorte para o piloto (não ingerir tudo de uma vez)

Alinhado ao PRD §5.2: carregar **toda** a base NCM e ICMS/siscomex/câmbio (são pequenas e
transversais), mas **curar anuência** só do segmento ativo:

| Fase | NCMs de anuência a curar |
|---|---|
| 1 — Cosmético | Cap. 33 (ex.: 3304.99.90) + normas ANVISA RDC 16/2014, 752/2022, 949/2024, 907/2024 |
| 2 — Químico | NCMs reais do piloto (a obter com despachante) — ANVISA/IBAMA |
| 3 — Agroquímico | Registro tripartite MAPA+ANVISA+IBAMA |

## Mapa mock → real (para a migração do app)

| Campo `NcmRule` (mock, `src/types.ts`) | Origem real |
|---|---|
| `ncm`, `description` | `ncm.codigo`, `ncm.descricao` |
| `standardIiRate` | `ncm_tributo.ii_pct` |
| `isAntidumpingActive` / `antidumping…` | `ncm_tributo.antidumping` (+ tabela dedicada futura) |
| `requiresAnvisa` / `checkMapaConflict` / `requiresAnatel` / `requiresInmetro` | `ncm_anuencia` (JOIN por órgão) |
| `hasExTarifario` / `exTarifarioRate` | `ncm_tributo` (coluna Ex-tarifário a adicionar) |
| `hasPisCofinsZeroOpportunity` / `pisCofinsZeroBasis` | derivado de `ncm_tributo.pis_pct/cofins_pct` = 0 + `norma` |
| `minReferencePrice` | tabela de preços de referência aduaneira (fonte a incorporar) |
