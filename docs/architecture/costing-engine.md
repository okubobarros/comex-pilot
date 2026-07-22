# Motor de custeio — as-is vs. to-be (IBS/CBS)

_Formaliza o PRD §4.3 e o fluxo n8n "Agente Custos CTI" como uma função versionada._

## Princípio: o motor é uma função de `data do fato gerador`

Não existe "fórmula antiga" e "fórmula nova" como dois caminhos de código. Existe **uma** função que
lê alíquotas versionadas (`ncm_tributo`, `ibs_cbs_regra`, `aliquota_ibs_cbs`, `icms_uf`) vigentes na
`data_fato_gerador`. A Reforma Tributária vira **dado**, não `if`.

```
custeio(ncm, uf, data_fato_gerador, incoterm, fob, frete, seguro, qtd_adicoes, usd_brl) -> CTI + tributos
```

## Modelo atual (as-is) — ainda em vigor

Sequência oficial (ICMS "por dentro", base cumulativa):

```
VMLD (valor aduaneiro)  = (FOB + frete + seguro) × USD/BRL     [câmbio: cambio_ptax]
II                      = VMLD × ii_pct
IPI                     = (VMLD + II) × ipi_pct
PIS                     = VMLD × pis_pct
COFINS                  = VMLD × cofins_pct
AFRMM                   = frete_marítimo × afrmm_pct            [icms_uf.afrmm_pct]
Taxa Siscomex           = f(qtde_adicoes)                       [siscomex_taxa]
Base ICMS               = (VMLD + II + IPI + PIS + COFINS + despesas) / (1 − icms_pct)   ["por dentro"]
ICMS                    = Base ICMS × icms_pct                  [icms_uf.icms_pct]
CTI                     = soma de tudo
```

## Modelo com IBS/CBS (to-be) — convivência, não substituição

O IBS/CBS **soma-se** ao cálculo as-is; o que muda por ano é (a) se PIS/COFINS ainda existem, (b) se
os novos tributos são compensáveis (não impactam caixa) e (c) o percentual de transição ICMS↔IBS.
Tudo isso vem de `ibs_cbs_regra` vigente na data.

```
regra = SELECT * FROM ibs_cbs_regra WHERE data_fato_gerador BETWEEN vigencia_inicio AND vigencia_fim

CBS_declarar = VMLD × regra.cbs_pct
IBS_declarar = VMLD × (aliquota_ibs_cbs específica se houver, senão regra.ibs_pct)

impacto_caixa_novos = (regra.cbs_compensavel ? 0 : CBS_declarar)
                    + (regra.ibs_compensavel ? 0 : IBS_declarar)

se regra.pis_cofins_ativo == false:  PIS = COFINS = 0
se regra.ipi_zerado == true (e não ZFM):  IPI = 0
```

### Tabela de transição (semente de `ibs_cbs_regra`)

| vigência | cbs_pct | ibs_pct | cbs/ibs compensável | pis_cofins_ativo | ipi_zerado | base legal |
|---|---|---|---|---|---|---|
| 2026-01-01 → 2026-12-31 | 0,9 | 0,1 | sim | sim | não | LC 214/2025 art. 348, I |
| 2027-01-01 → 2028-12-31 | cheia | 0,1 | conforme regra | **não** | sim (exc. ZFM) | LC 214/2025 |
| 2029-01-01 → 2032-12-31 | cheia | sobe 10%/ano | conforme regra | não | sim | transição ICMS−10%/ano |
| 2033-01-01 → 9999 | cheia | definitiva | conforme regra | não | sim | regime definitivo |

> Percentuais de 2027+ a confirmar com tributarista antes de semear (o PRD marca isso como pendência).

## Implementação (Sprint 3)

Motor implementado como **função pura** em [`src/engine/costing.ts`](../../src/engine/costing.ts)
(`computeCosting(input, rates)`): determinística, sem I/O — as alíquotas já chegam resolvidas em
`rates` (versionadas por data). Teste executável em [`scripts/test_costing.ts`](../../scripts/test_costing.ts):

```bash
npm run test:costing
```

Cobre: caso cosmético 2026 (conferido à mão), fase 2027 sintética (PIS/COFINS extintos, IPI zerado,
CBS/IBS ao caixa) e AFRMM sobre frete. **Todos passam.**

### ⚠️ Base de cálculo do CBS/IBS — v1

A base usada é **VMLD (valor aduaneiro)**. O Decreto 12.955/2026 art. 13 detalha a composição
(inclui frete/seguro/tributos/taxas; exclui CBS/IBS e IPI) — a composição exata está **pendente de
validação com o tributarista**. O campo `baseIbsCbs` é exposto no resultado para auditoria.

## Reconciliação com o PRD (pendente de inputs)

O PRD cita: creme 3304.99.90, FOB US$10.000, 2026 → CTI **R$ 104.770,34**, CBS R$ 524,28, IBS
R$ 58,25. Reproduzir **ao centavo** exige as premissas exatas do PRD (câmbio, frete, seguro, UF/ICMS,
nº de adições), que não estão no documento. Ex.: CBS 524,28 a 0,9% ⇒ base ≈ R$ 58.253 ⇒ câmbio ≈
5,825 (se base = VMLD) — ou base maior a câmbio menor. **Ação:** obter a planilha/premissas originais
do Custos CTI para fechar o número e virar teste de regressão oficial (ver
[../data/data-acquisition-checklist.md](../data/data-acquisition-checklist.md)).

## Onde isso encaixa no app

- Hoje: [`src/components/LandedCostDrawer.tsx`](../../src/components/LandedCostDrawer.tsx) coleta
  inputs e calcula localmente o modelo antigo.
- Alvo: o Drawer chama o endpoint `POST /api/costing` (backend), que roda a função versionada e
  devolve `{ vmld, ii, ipi, pis, cofins, afrmm, siscomex, icms, cti, cbs_declarar, ibs_declarar,
  impacto_caixa_novos, base_legal[] }`. A UI ganha uma linha "IBS/CBS a declarar" e um selo
  "compensável — sem impacto de caixa".
- O fluxo n8n "Custos CTI" implementa a mesma função (ver
  [../ops/n8n-flows-audit.md](../ops/n8n-flows-audit.md)); backend e n8n compartilham a mesma tabela.
