# Triagem dos artefatos recebidos (lote CEO 2026-07-21)

_Análise dos 8 arquivos entregues: o que serve, o que é parcial, o que descartar, e o que ainda
falta. Regra geral observada: os CSVs são em grande parte a **mesma lista de NCMs** (cosmético
cap. 33 · agroquímico 3808 · químico 2901/2902) repetida com colunas diferentes. O valor está
concentrado; muitas colunas são **fórmula em texto** (metodologia), não dado carregável._

## ✅ SERVE — incorporar (alto valor)

| Arquivo | Por que serve | Vira |
|---|---|---|
| **mapa_orgaos_anuentes_segmentos.csv** | Anuência por NCM. **Cosmético (cap. 33) → ANVISA + RDCs está pronto.** Preenche a lacuna P0 §5.2 do checklist. | Seed direto de `ncm_anuencia` (cosmético) |
| **template_formula_precificacao_importacao.csv** | **Único arquivo com alíquotas numéricas reais** por NCM cosmético (ex.: 3304.99.90 → II 18 / IPI 14,3 / PIS 2,1 / COFINS 9,65). Confirma a estrutura as-is/to-be. | Cross-check de `ncm_tributo` (cosmético) + validação do motor |
| **especificacao_funcional_sistema_importacao.csv** | **Contrato de I/O do app real**: blocos Entrada / Validação / Cálculo / Saída (inclui saídas Custo as-is, Custo to-be, Margem, Preço sugerido, Alertas). | Alinha o data model + formulário LandedCost + payload do motor |
| **Documento sem título.md** | **Fontes legais confirmadas + parâmetros reais.** Responde vários P0 (ver abaixo). | Grounding do RAG + regras do motor |

### O que o `Documento sem título.md` já resolve (P0)
- **AFRMM (alíquotas federais reais):** 25% longo curso · 10% cabotagem · 40% fluvial/lacustre (granéis líquidos N/NE). → resolve §4.2 do checklist.
- **Base de cálculo CBS/IBS (Decreto 12.955/2026, art. 13):** inclui frete, seguro, tributos e taxas; **exclui CBS/IBS e IPI**. → resolve §3.4 (regra da base).
- **Fontes IBS/CBS:** LC 214/2025 + LC 227/2026 (Planalto), Decreto 12.955/2026 (CBS), Resolução CGIBS 6/2026 (IBS). → resolve §6.2.
- **Ex-tarifários:** portal MDIC, lista vigente atualizada 13/07/2026 (URL localizada). → localiza §1.2 (falta baixar o dado).
- **ANVISA cosmético:** RDC 907/2024 (definição/rotulagem/controle) + 752/2022 (norma-base). → reforça §6.1.

## 🟡 PARCIAL — serve como esqueleto, não como dado final

| Arquivo | Situação |
|---|---|
| **playbook_calculo_importacao_cosmetico.csv** | Narrativa passo-a-passo do cálculo por NCM. Útil como **spec legível / base de eval**, mas redundante com o template. Manter **um** como doc de metodologia. |
| **dicionario_regras_segmentos_importacao.csv** | Mescla anuência + regra de cálculo (texto genérico "CIF × alíquota II"). A parte de anuência cosmética é útil (duplica o `mapa_orgaos`); o resto é metodologia. |

## ❌ NÃO SERVE / descartar como fonte de dados

| Item | Por quê |
|---|---|
| **playbook_calculo_importacao_agroquimico.csv** e **_quimico.csv** | Fórmula genérica repetida; anuência "PENDENTE"/"A definir". **Nenhum dado carregável** além da lista de NCMs (que já vem da base NCM oficial). São P1/P2, não P0. |
| **Colunas de fórmula em texto** (em qualquer arquivo: `CIF × alíquota II`, `=FOB+Frete+...`) | A fórmula vira **código uma vez** (o motor de custeio). Não ingerir as strings. |
| **Anuência do químico = "SEFAZ/Órgão específico"** | **Conceitualmente errado** — SEFAZ é fisco estadual, não órgão anuente. O próprio arquivo marca "NÃO É LISTA FINAL". Descartar esse valor. |
| **Coluna AFRMM da aba `icms` (tax_calc.xlsx)** | Tinha 0/8 por estado, **conflita** com as alíquotas federais reais (25/10/40%) confirmadas no `Documento`. Usar a regra federal por modal; descartar a coluna da planilha. |

## ⚠️ Problemas de qualidade a tratar no ETL

1. **Anuência químico** é placeholder (SEFAZ) → não semear; deixar como "a validar".
2. **Anuência agroquímico** é "PENDENTE tripartite" → não semear como verdade; sinalizar risco alto.
3. **AFRMM**: usar 25/10/40% por modal, não a coluna da planilha.
4. **PIS/COFINS-Importação cosmético**: template usa 2,1% / 9,65%; **validar adicional de 1% de COFINS-Importação** que incide sobre vários NCMs do cap. 33 (confirmar com tributarista).
5. **Base PIS/COFINS e IPI**: confirmar base exata (valor aduaneiro vs base própria) — a planilha diz "base vigente da importação" sem fórmula.

## O que ISSO muda no checklist (itens agora resolvidos ou avançados)

| Item do checklist | Antes | Agora |
|---|---|---|
| §5.2 Anuência cosmético (NCM→ANVISA+base legal) | 🟡 a curar | ✅ **pronto** (mapa_orgaos) |
| §4.2 AFRMM | 🟡 confirmar | ✅ **confirmado** (25/10/40%) |
| §3.4 Base de cálculo IBS/CBS | 🟡 | ✅ **regra conhecida** (Decreto art. 13) |
| §6.2 Legislação IBS/CBS (fontes) | 🟡 | ✅ **fontes localizadas** (falta baixar textos) |
| §1.2 Ex-tarifários | 🔴 | 🟡 **URL localizada** (falta baixar a lista) |
| §6.1 Normas ANVISA cosmético | 🔴 | 🟡 **normas identificadas** (falta o texto integral p/ chunk) |
| App I/O (campos de entrada/saída) | — | ✅ **especificado** (especificacao_funcional) |

## O que AINDA falta (P0 remanescente)

1. **Percentuais numéricos de transição IBS/CBS 2027→2033** — temos as fontes, falta o tributarista extrair a tabela de números (§3.2).
2. **Baixar a lista de Ex-tarifários** do MDIC (§1.2) e o **texto integral** das RDCs ANVISA + leis IBS/CBS para o RAG (§6.1/§6.2).
3. **Confirmar** adicional COFINS-Importação, base PIS/COFINS/IPI, e valores atuais da Taxa Siscomex.
4. **Câmbio PTAX** feed vivo (§4.4) e **amostras documentais reais + gabarito** (§7).
5. **Preço de referência aduaneira** e **antidumping detalhado** (P1).

## Conclusão operacional

Com este lote, o **piloto cosmético fica praticamente completo em dados** para a Sprint 1: base NCM
(oficial) + tributos federais (Ctax/template) + anuência ANVISA (mapa_orgaos) + AFRMM/ICMS/Siscomex/
câmbio + regra de base CBS/IBS. Falta só a **tabela numérica de transição 2027→2033** (tributarista)
e os **textos normativos** para citação. Químico e agroquímico permanecem P1/P2 (anuência não
validada) — descartar os playbooks desses dois como fonte e usar a base NCM oficial quando chegarem
os NCMs reais do cliente.
