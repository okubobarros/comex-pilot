# Avaliação do PRD Mestre — forças, lacunas e implicações de engenharia

_Análise técnica do [prd-mestre.md](prd-mestre.md) sob a ótica de "o que precisamos construir".
Data: 2026-07-21._

## Veredito rápido

O PRD é **forte de narrativa e de posicionamento** (timing regulatório, TAM, comparação com Harvey,
guardrails alinhados ao EU AI Act) e — o mais importante para engenharia — **já converge com o app
que existe**: o Centro de Operações orientado a intenção que acabamos de construir é exatamente o
"produtos separados por nível de compromisso" que o PRD defende. A tese de arquitetura (agentes
independentes + versionamento temporal de norma e tributo + trilha de evidências) é sólida e
implementável de forma incremental.

O risco não está na visão — está na **distância entre o protótipo (dados mock, heurística local) e
o que o PRD descreve como já pronto**. Abaixo, o mapeamento honesto.

## Forças (manter e proteger)

1. **Arquitetura de agentes desacoplados.** O insight "não force o usuário a rodar o pipeline
   inteiro" é o diferencial de UX e de custo. O app já reflete isso (intenções `audit` / `classify`
   / `risk` separadas). Preservar ao migrar para backend real.
2. **Versionamento temporal como primitiva única.** Tratar norma e tributo com o mesmo desenho
   (`vigencia_inicio`/`vigencia_fim` + flag `compensavel` + `data do fato gerador`) evita reescrita
   de fórmula a cada fase da Reforma. Isso é a decisão de modelagem mais importante do documento.
3. **Trilha de evidências como produto, não log.** "Base legal + impacto + plano de ação lado a
   lado" já está na UI (Veredito). Dá para transformar em citação clicável com baixo esforço.
4. **Escala por complexidade regulatória** (cosmético → químico → agroquímico) é um plano de dados
   incremental, não um big-bang — casa perfeitamente com sprints.

## Lacunas e riscos (o que o PRD assume pronto e ainda não está)

| # | Lacuna | Evidência | Ação |
|---|---|---|---|
| L1 | **"Tributos reais carregados" vive em planilha, não em banco consultável** | `tax_calc.xlsx` (abas `tax`/`Ctax`/`icms`/`siscomex`/`exchange_rate`) | Sprint 1 — ingestão para Postgres. Ver [data/ncm-tax-base.md](../data/ncm-tax-base.md) |
| L2 | **App usa dados mock, não a base real** | `src/data/mockScenarios.ts` (`DEFAULT_NCM_RULES` hardcoded) | Sprint 2 — trocar heurística por consulta à base |
| L3 | **Motor de custeio não tem IBS/CBS nem transição** | `src/components/LandedCostDrawer.tsx` e o fluxo Custos CTI calculam só o modelo antigo | Sprint 3 — motor versionado. Ver [architecture/costing-engine.md](../architecture/costing-engine.md) |
| L4 | **Fluxos n8n legados (>1 ano), não reaproveitáveis** | `Classificador_fiscal` e `Custos CTI` com lógica antiga e segredos mortos | Descartar; usar só como referência de lógica. **Decisão CEO: não rotacionar/não manter.** Ver [ops/n8n-flows-audit.md](../ops/n8n-flows-audit.md) |
| L5 | **Modelo de linguagem antigo/gratuito** | `amazon/nova-2-lite-v1:free` e `gemini-2.5-flash-lite` fixos | Sprint 4 — camada de roteamento dinâmico (o "modelo antigo não é mais útil" do briefing) |
| L6 | **"Graph-RAG / grafo normativo versionado" ainda não existe** | PRD 4.1 descreve; implementação atual é file-search store simples | Fase 1+ — começar com RAG vetorial (pgvector) e modelar o grafo como relações antes de adotar DB de grafo dedicado |
| L7 | **Sem persistência de processo/decisão/trilha** | Entidades 4.4 são projeto, não schema aplicado | Sprint 2 — criar tabelas operacionais |
| L8 | **Qualidade de dados** | ICMS da Bahia gravado como `20,50` (vírgula) enquanto os demais usam ponto; datas `31/12/9999` como sentinela | Tratar no ETL (normalização numérica e de datas) |
| L9 | **Evals (H1–H4) sem harness** | PRD define metas, não há suíte | Fase transversal — criar dataset dourado por segmento |

## Implicações de engenharia (decisões que o PRD força)

1. **Banco de dados = Postgres (Supabase) + pgvector.** O fluxo Custos CTI já grava no Supabase; a
   base NCM/tributos é relacional por natureza; o RAG precisa de vetores. Não introduzir DB de grafo
   dedicado (Neo4j) nesta fase — modelar o grafo normativo como relações versionadas e reavaliar
   quando o raciocínio multi-hop exigir. Detalhe em [architecture/data-model.md](../architecture/data-model.md).
2. **A planilha é a fonte, o Postgres é a verdade.** `tax_calc.xlsx` e a Tabela NCM vigente viram
   um pipeline de ingestão idempotente e versionado (não import manual único).
3. **O motor de custeio é uma função de `(NCM, UF, data_fato_gerador, incoterm, valores)`** que lê
   alíquotas versionadas — não uma constante. Isso permite as-is e to-be sem branch de código.
4. **Backend precisa existir de fato.** Hoje o `server.ts` chama Gemini direto. O alvo é um serviço
   que expõe cada agente como endpoint invocável (espelhando os webhooks n8n), com o app consumindo
   esses endpoints em vez de heurística local.

## Recomendação de sequência

A ordem de maior valor/menor risco: **L4 (segredos) agora → L1/L8 (dados no banco) → L2 (app lê
banco) → L3 (IBS/CBS) → L5/L6 (roteamento + RAG) → evals**. É exatamente a sequência de
[roadmap/sprints.md](../roadmap/sprints.md).
