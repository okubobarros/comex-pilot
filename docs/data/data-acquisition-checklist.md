# Checklist de aquisição de dados — o que levantar para carregar real

_Lista mestre para o CEO. Objetivo: reunir tudo que falta para tirar o app do mock e rodar com dado
real, começando pelo piloto **cosmético** (ANVISA) de ponta a ponta._

> **Atualização 2026-07-21:** dois lotes de artefatos do CEO já resolveram vários itens P0 — ver
> [incoming-artifacts-analysis.md](incoming-artifacts-analysis.md). Os status abaixo já refletem isso.
> Recebidos também: texto integral da LC 214/2025 (+DOU) e da RDC 907/2024 (RAG), e cotação PTAX do dia.
>
> **Prontidão para Sprint 0:** ✅ **nada bloqueia.** A Sprint 0 é só infraestrutura (schema +
> migrations + scaffold + `.env.example`) e não consome nenhum dado externo. Os itens 🔴/🟡 abaixo
> são para a **Sprint 1+** (ingestão), não para a 0.

## Como ler esta lista

- **Status:** ✅ já temos (arquivo em mãos) · 🟡 temos parcial · 🔴 falta levantar.
- **Prioridade:** **P0** = bloqueia o piloto cosmético end-to-end · **P1** = químico · **P2** = agroquímico · **T** = transversal.
- **Quem levanta:** 🧑‍💼 CEO (fontes públicas/documentais) · ⚖️ tributarista · 🛃 despachante · 🏗️ eng.

> Regra de ouro do PRD (§5.2): **carregar tudo que é transversal e pequeno** (NCM, ICMS, siscomex,
> câmbio), mas **curar anuência só do segmento ativo** (cosmético primeiro). Não tente mapear os três
> segmentos de uma vez.

---

## 1. Classificação fiscal (base NCM)

| # | Item | Status | O que falta | Fonte | Prio | Quem |
|---|---|---|---|---|---|---|
| 1.1 | Tabela NCM vigente (15.161 códigos) | ✅ | — (temos `Tabela_NCM_Vigente_20260721.xlsx`) | Receita/CAMEX | P0 | — |
| 1.2 | Ex-tarifários (reduções temporárias de II por NCM) | 🟡 | Página-índice CAMEX recebida (aponta p/ Gecex 272/2021 e anexos) — **falta o dado tabular** (NCM→II reduzido→vigência) das resoluções Gecex | resoluções Gecex | P0 | 🧑‍💼 |
| 1.3 | Preço de referência aduaneira (valor mínimo por NCM p/ flag de subfaturamento) | 🔴 | Fonte de preços parametrizados **ou** decidir proxy (ex.: média histórica de DI) | Receita (valoração) / interno | P1 | 🧑‍💼+🛃 |

## 2. Tributos federais por NCM

| # | Item | Status | O que falta | Fonte | Prio | Quem |
|---|---|---|---|---|---|---|
| 2.1 | II, IPI, PIS, COFINS por NCM (10.519 linhas) | ✅ | carregado na Sprint 1 (`tax_calc.xlsx` aba **`tax`**; a `Ctax` está vazia) | TEC / Receita | P0 | — |
| 2.2 | Antidumping — **detalhe** (não só o flag) | 🟡 | Alíquota/US$ por kg, origem, nº da resolução, vigência, por NCM | Gecex/CAMEX (resoluções antidumping) | P1 | 🧑‍💼 |
| 2.3 | CIDE e Medidas compensatórias — detalhe | 🟡 | Base de cálculo e alíquota quando aplicável | Receita | P2 | ⚖️ |
| 2.4 | Data-base dos tributos (quando essa tabela foi extraída) | 🔴 | Confirmar a data de vigência p/ versionar corretamente | interno | P0 | 🧑‍💼 |

## 3. Reforma Tributária — IBS/CBS (o núcleo do to-be)

| # | Item | Status | O que falta | Fonte | Prio | Quem |
|---|---|---|---|---|---|---|
| 3.1 | Alíquotas 2026 (CBS 0,9% / IBS 0,1%, compensáveis) | ✅ | — (do PRD, LC 214/2025 art. 348, I) | LC 214/2025 | P0 | — |
| 3.2 | **Cronograma de transição 2027→2033** (percentuais por ano) | 🟡 | CBS cheia em 2027; ramp do IBS; redução ICMS 10%/ano 2029–33 — **percentuais exatos confirmados** | LC 214/2025, LC 227/2026, Decreto 12.955/2026, Res. CGIBS 6/2026 | P0 | ⚖️ |
| 3.3 | Alíquota de referência do IBS por UF | 🔴 | Alíquota estadual/municipal de referência por estado, conforme publicada | Comitê Gestor do IBS (CGIBS) | P1 | ⚖️ |
| 3.4 | Regras de creditamento/compensação + base de cálculo | 🟡 | **Base já conhecida** (Decreto 12.955/2026 art. 13: inclui frete/seguro/tributos/taxas, exclui CBS/IBS/IPI). Falta detalhar creditamento | LC 214/2025 + Decreto 12.955 | P0 | ⚖️ |
| 3.5 | Tratamento ZFM / regimes especiais | 🔴 | Exceções (ex.: IPI não zera na ZFM em 2027) | legislação | P2 | ⚖️ |

## 4. Custeio e valores regionais

| # | Item | Status | O que falta | Fonte | Prio | Quem |
|---|---|---|---|---|---|---|
| 4.1 | ICMS por UF (27 estados) | ✅ | — (`tax_calc.xlsx` aba `icms`; corrigir BA `20,50`) | SEFAZ estaduais | P0 | — |
| 4.2 | AFRMM (% sobre frete marítimo) | ✅ | **Confirmado:** 25% longo curso · 10% cabotagem · 40% fluvial/lacustre granéis líq. N/NE (Receita Federal) | — | P0 | — |
| 4.3 | Taxa Siscomex (por nº de adições) | ✅ | Confirmar se os valores são os atuais (reajustam) | Receita | P0 | 🧑‍💼 |
| 4.4 | Câmbio PTAX (série diária USD/EUR) | ✅ | **Decisão: buscar via API.** BCB Olinda PTAX (grátis, sem chave) — `olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(...)`. A aba histórica do xlsx serve só de bootstrap. | API BCB | P0 | 🏗️ |
| 4.5 | Regras por Incoterm (o que entra no VMLD: FOB/CFR/CIF…) | 🔴 | Tabela de composição do valor aduaneiro por incoterm | IN RFB 2.090/2022 (valoração) | P0 | 🛃 |
| 4.6 | Despesas aduaneiras acessórias (capatazia/THC, armazenagem, honorários) | 🔴 | Valores típicos **ou** decidir que entram como input manual | despachante / interno | P1 | 🛃 |

## 5. Anuência e órgãos anuentes (curadoria por segmento)

| # | Item | Status | O que falta | Fonte | Prio | Quem |
|---|---|---|---|---|---|---|
| 5.1 | Lista de órgãos anuentes | ✅ | — (ANVISA, MAPA, IBAMA, INMETRO, ANATEL, DECEX, SUFRAMA) | — | P0 | — |
| 5.2 | **Cosmético:** mapa NCM (cap. 33) → exigência ANVISA + base legal | ✅ | **Pronto** — `mapa_orgaos_anuentes_segmentos.csv` vincula NCMs cap. 33 às 4 RDCs + LPCO | recebido | **P0** | — |
| 5.3 | **Químico:** NCMs reais do piloto + órgão (ANVISA/IBAMA) | 🔴 | Lista real de NCMs do cliente-piloto químico e qual anuência | despachante | P1 | 🛃 |
| 5.4 | **Agroquímico:** registro tripartite MAPA+ANVISA+IBAMA | 🔴 | NCMs + exigências dos três órgãos | despachante + órgãos | P2 | 🛃 |

## 6. Base normativa para RAG (citação clicável)

| # | Item | Status | O que falta | Fonte | Prio | Quem |
|---|---|---|---|---|---|---|
| 6.1 | Texto integral das normas do cosmético | 🟡 | **RDC 907/2024 recebida** (texto integral). Faltam RDC 752/2022, 16/2014, 949/2024 + IN de valoração | ANVISA, Receita | P0 | 🧑‍💼 |
| 6.2 | Texto da legislação IBS/CBS | 🟡 | **LC 214/2025 recebida** (integral + DOU). Faltam LC 227/2026, Decreto 12.955/2026, Res. CGIBS 6/2026 | Planalto | P0 | 🧑‍💼 |
| 6.3 | Metadados por norma (tipo, órgão, vigência, ementa) | 🔴 | Preencher ao ingerir cada norma | curadoria | P0 | 🏗️ |
| 6.4 | Relações entre normas (revoga/altera/regulamenta) | 🔴 | Mapear no segmento cosmético primeiro | curadoria | P1 | ⚖️ |

## 7. Documentos e dataset de avaliação (evals H1–H4)

| # | Item | Status | O que falta | Fonte | Prio | Quem |
|---|---|---|---|---|---|---|
| 7.1 | Amostras reais de Invoice / Packing List / BL / DUIMP (anonimizadas) | 🔴 | 10–20 pacotes reais do cosmético p/ testar extração/conciliação | clientes-piloto | P0 | 🧑‍💼+🛃 |
| 7.2 | Gabarito (output esperado) por amostra | 🔴 | Classificação + custeio + anuências corretos, validados por humano | despachante | P0 | 🛃 |
| 7.3 | Caso de regressão do custeio | ✅ | — (creme 3304.99.90, CTI R$ 104.770,34, do PRD) | PRD | P0 | — |

---

## Resumo executivo — o que travar primeiro (P0 do piloto cosmético)

Para rodar o cosmético de ponta a ponta com dado real, o **mínimo** a levantar agora:

1. **Cronograma IBS/CBS 2027→2033 confirmado** (§3.2, §3.4) — ⚖️ tributarista.
2. **Ex-tarifários vigentes** (§1.2) — 🧑‍💼.
3. **Mapa NCM cap. 33 → exigência ANVISA + base legal** (§5.2) — 🛃 + curadoria.
4. **Texto das 4 RDCs ANVISA + legislação IBS/CBS** para o RAG (§6.1, §6.2) — 🧑‍💼.
5. **Confirmar data-base dos tributos, AFRMM e Siscomex** (§2.4, §4.2, §4.3) — 🧑‍💼.
6. **Regras de Incoterm/valoração** (§4.5) — 🛃.
7. **10–20 pacotes documentais reais + gabarito** (§7.1, §7.2) — 🧑‍💼 + 🛃.

Tudo que está ✅ (NCM, tributos federais, ICMS, siscomex, câmbio histórico) **já dá para ingerir na
Sprint 1 sem esperar** o resto. Os itens 🔴/🟡 acima entram à medida que você levanta.
