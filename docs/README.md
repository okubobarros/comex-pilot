# Documentação — MCAT / ComexPilot

Documentação de produto e engenharia do **MCAT** (arquitetura multiagente de conformidade
aduaneira e tributária) e do **ComexPilot** (o app que a materializa).

> O ComexPilot em produção hoje é o protótipo funcional (Vite + React + Express + Gemini)
> deste repositório. Este conjunto de documentos descreve a visão do PRD Mestre e o caminho
> para evoluir o protótipo (dados mock → dados reais + backend multiagente).

## Índice

| Documento | O que cobre |
|---|---|
| [product/prd-mestre.md](product/prd-mestre.md) | PRD Mestre — cópia canônica versionada (visão, mercado, UX, arquitetura, dados, roadmap) |
| [product/prd-evaluation.md](product/prd-evaluation.md) | Avaliação crítica do PRD: forças, lacunas e implicações de engenharia |
| [architecture/data-model.md](architecture/data-model.md) | Escolha de banco de dados e schema (referência + operacional + vetorial) |
| [architecture/costing-engine.md](architecture/costing-engine.md) | Motor de custeio: modelo atual (as-is) vs. IBS/CBS (to-be) com versionamento temporal |
| [data/ncm-tax-base.md](data/ncm-tax-base.md) | Como a base NCM e as tabelas de tributos viram tabelas + pipeline de ingestão |
| [data/data-acquisition-checklist.md](data/data-acquisition-checklist.md) | **Checklist do CEO:** tudo que falta levantar para carregar dado real, por prioridade |
| [data/incoming-artifacts-analysis.md](data/incoming-artifacts-analysis.md) | Triagem do lote de artefatos recebidos: o que serve, é parcial, descartar, e o que falta |
| [ops/n8n-flows-audit.md](ops/n8n-flows-audit.md) | Fluxos n8n legados (referência de lógica) + proposta de melhoria que os substitui |
| [ops/sprint-0.md](ops/sprint-0.md) | Sprint 0 entregue: schema + seeds do piloto cosmético, como aplicar e evidência de validação |
| [ops/sprint-1.md](ops/sprint-1.md) | Sprint 1 (parcial): ETL da base real (NCM 15k + tributos + referência), como rodar e validação |
| [roadmap/sprints.md](roadmap/sprints.md) | Plano de sprints derivado do roadmap do PRD |

## Como reproduzir "a ideia do app real"

O protótipo já tem a **casca certa** (Centro de Operações orientado a intenção, Painel de
Comando conversacional, Veredito da Auditoria com trilha de evidências). O que falta é trocar
o **miolo mock por dados e agentes reais**:

```
HOJE (protótipo)                          ALVO (app real)
─────────────────                         ───────────────
DEFAULT_NCM_RULES (hardcoded)      →      Base NCM + tributos no Postgres (15.161 NCMs)
rulesEngine.ts (heurística)        →      Motor de custeio versionado (as-is + IBS/CBS)
classifier.ts (heurística local)   →      Agente Classificador RAG (Graph-RAG + citação)
PRESET_SCENARIOS (mock)            →      Processos reais persistidos + trilha append-only
Gemini direto no server.ts         →      Roteamento dinâmico de modelo (custo/latência)
```

Cada sprint em [roadmap/sprints.md](roadmap/sprints.md) fecha uma dessas setas sem quebrar a UI já existente.
