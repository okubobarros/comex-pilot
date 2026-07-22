# Alíquotas: o que temos, de onde vêm, e o que ainda é dúvida

_Resposta detalhada: como o motor resolve cada alíquota, e por que a `tax_calc.xlsx` **não** é a
planilha original do Custos CTI._

## 1. De onde o motor tira cada alíquota (resolver `mcat`)

Ao calcular, o endpoint `POST /api/costing` resolve as alíquotas por **(NCM, UF, data do fato
gerador)** — nada hardcoded:

| Alíquota | Tabela `mcat` | Como é escolhida | Fonte original |
|---|---|---|---|
| II, IPI, PIS, COFINS | `ncm_tributo` | por NCM, vigência ≤ data (mais recente) | `tax_calc.xlsx` aba **`tax`** (10.519 linhas, 100% com II) |
| ICMS | `icms_uf` | pela UF do porto de entrada | `tax_calc.xlsx` aba `icms` (27 estados) |
| AFRMM | `afrmm_aliquota` | pelo **modal** (25% longo curso / 10% cabotagem / 40% fluvial N-NE) | Receita Federal (confirmado) |
| Taxa Siscomex | `siscomex_taxa` | pelo nº de adições da DI | `tax_calc.xlsx` aba `siscomex` |
| CBS, IBS + flags | `ibs_cbs_regra` | pela regra vigente na data | LC 214/2025 (2026 semeado) |
| Câmbio | `cambio_ptax` / input | PTAX; hoje via input, produção via API BCB | BCB Olinda |

Verificado no app: NCM 3304.99.90 + Santos(SP) → II 18% · IPI 14,3% · PIS 2,1% · COFINS 9,65% ·
ICMS 18% · AFRMM 25% · Siscomex R$ 154,23. Tudo vindo do banco.

## 2. Dúvidas/pendências reais de alíquota (para o tributarista)

Estas afetam o número final e **não** estão resolvidas nos dados que temos:

1. **Adicional de 1% de COFINS-Importação** — vários NCMs do cap. 33 (cosméticos) têm COFINS-Imp
   majorada (9,65% + 1% = 10,65%). A aba `tax` traz 9,65%; falta confirmar em quais NCMs incide o +1%.
2. **Base de cálculo do CBS/IBS** — o motor usa **VMLD** (v1). O Decreto 12.955/2026 art. 13 diz que a
   base inclui frete, seguro, tributos e taxas e exclui CBS/IBS e IPI. A composição exata (entra ICMS?
   entra II?) precisa ser confirmada — muda o valor de CBS/IBS a declarar.
3. **Base de PIS/COFINS-Importação** — hoje aplicamos sobre o VMLD. Historicamente a base tinha
   nuances (ex.: inclusão do ICMS foi objeto de disputa/mudança). Confirmar a base vigente em 2026.
4. **Transição IBS/CBS 2027→2033** — os percentuais por ano (CBS cheia, ramp do IBS, ICMS −10%/ano)
   ainda não estão na tabela `ibs_cbs_regra` (só 2026). São fixados por resolução do Senado/CGIBS.
5. **Alíquota de referência do IBS por UF** — para 2027+ o IBS é estadual/municipal; falta a tabela
   por UF.
6. **Ex-tarifários** — reduções temporárias de II por NCM (ainda a baixar das resoluções Gecex);
   quando aplicáveis, sobrepõem o II padrão.

## 3. A planilha original do Custos CTI — o que é e o que não é

**A `tax_calc.xlsx` NÃO é a planilha de simulação do Custos CTI.** Verifiquei todas as 6 abas
(`exchange_rate`, `tax`, `Ctax`, `icms`, `siscomex`, `consulta`): não há nenhuma simulação com FOB
US$ 10.000, nem o valor R$ 104.770,34, nem premissas de câmbio/frete/margem. Os "creme" que aparecem
são **"Creme de leite"** (cap. 04, laticínios), não cosmético. Ou seja, a `tax_calc.xlsx` é a **base
de alíquotas** — insumo do cálculo, não o cálculo.

O número **R$ 104.770,34** do PRD veio de outro lugar — muito provavelmente a **saída do workflow n8n
"Custos CTI"** (que fazia o cálculo com premissas próprias), ou uma planilha de simulação separada.

### O que falta para reconciliar os R$ 104.770,34

O motor está correto (validado à mão). Para reproduzir **o número exato** do PRD, preciso das
**premissas** daquela simulação, que não estão no PRD nem na `tax_calc`:

- câmbio USD/BRL usado;
- frete e seguro internacionais;
- UF de destino (define o ICMS) e nº de adições;
- se havia despesas aduaneiras (capatazia/armazenagem) embutidas;
- a base exata de CBS/IBS usada (item 2 acima).

**Como fechar:** me passe **a planilha/execução original do Custos CTI** (ou o print da simulação do
PRD com as premissas). Com isso eu ajusto a base do motor se necessário e crio um **teste de
regressão oficial** que trava o número. Um teste rápido de sanidade: CBS de R$ 524,28 a 0,9% implica
base ≈ R$ 58.253 → se a base for o VMLD, o câmbio da simulação foi ≈ **5,825**; se a base for maior
(art. 13), o câmbio foi menor. Só a simulação original desfaz essa ambiguidade.
