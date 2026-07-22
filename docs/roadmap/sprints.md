# Plano de sprints

_Desdobra o to-do imediato e as fases do PRD §6 em blocos executáveis. Ordem = maior valor / menor
risco. Sprints de ~1–2 semanas; ajustar à capacidade real do time._

## Sprint 0 — Fundação ✅ ENTREGUE

**Objetivo:** ter onde colocar dado real e descartar o legado. Detalhe e evidência em [ops/sprint-0.md](../ops/sprint-0.md).

- [x] Schema Postgres das camadas 1–5 (`migrations/0001_init.sql`) — validado em pgvector pg16.
- [x] `.env.example` do backend atualizado (sem valores).
- [x] Seeds do piloto cosmético (`seeds/0001_static.sql`, `seeds/0002_cosmetico.sql`) + gerador reprodutível.
- [x] Estrutura de pastas: `migrations/`, `seeds/`, `scripts/etl/`, `data/sources/`.
- [ ] Aplicar no Supabase existente (você executa) — requer limpeza do legado antes. Ver [ops/sprint-0.md](../ops/sprint-0.md).

**Entrega:** migrations + seeds validados no repo, prontos para aplicar.

> Nota: os fluxos n8n são antigos e **não serão reaproveitados nem rotacionados** — decisão do CEO.
> Sem ação de segurança pendente.

## Sprint 1 — Ingestão da base real (NCM + tributos)

**Objetivo:** a verdade sai da planilha e vai para o banco.

- [ ] Script ETL `scripts/etl/` idempotente para: `ncm` (15.161), `ncm_tributo` (`Ctax`), `icms_uf`, `siscomex_taxa`, `cambio_ptax`. Ver [data/ncm-tax-base.md](../data/ncm-tax-base.md).
- [ ] Normalização (vírgula→ponto, `Sim/Não`→bool, sentinela `9999`, código nos 2 formatos).
- [ ] Semear `orgao_anuente` (ANVISA, MAPA, IBAMA, INMETRO, ANATEL, DECEX, SUFRAMA).
- [ ] Parsing de `Tratamentos Administrativos` → `ncm_anuencia` (curadoria **cosmético** primeiro).
- [ ] Registro de carga em `event_log`.

**Entrega:** `SELECT` de qualquer NCM retorna tributos e anuências reais.

## Sprint 2 — App lê a base real (fim do mock)

**Objetivo:** trocar o miolo mock sem tocar na UI.

- [ ] Endpoint backend `GET /api/ncm/:codigo` retornando o shape de `NcmRule` a partir do `JOIN` real.
- [ ] `rulesEngine.ts` / `classifier.ts` passam a consultar o backend (fallback heurístico só offline).
- [ ] Substituir `DEFAULT_NCM_RULES` / `PRESET_SCENARIOS` por dados vindos do banco; manter tipos.
- [ ] Persistir `processo` / `documento` / `divergencia` / `decisao` ao rodar uma auditoria.
- [ ] Verificar no preview que auditoria e classificação continuam funcionando com dado real.

**Entrega:** o Veredito da Auditoria mostra números reais; processos ficam salvos.

## Sprint 3 — Motor de custeio versionado (IBS/CBS) — item nº 1 do PRD

**Objetivo:** custeio correto na Reforma Tributária.

- [ ] Tabelas `ibs_cbs_regra` e `aliquota_ibs_cbs` + seed 2026 (0,9% CBS / 0,1% IBS, compensável).
- [ ] Função `custeio(...)` versionada por `data_fato_gerador` ([architecture/costing-engine.md](../architecture/costing-engine.md)).
- [ ] Teste de regressão com o caso do PRD (creme 3304.99.90, CTI R$ 104.770,34).
- [ ] Endpoint `POST /api/costing`; `LandedCostDrawer` consome e mostra linha "IBS/CBS a declarar" + selo "compensável".
- [ ] Atualizar o workflow n8n **Custos CTI** para a mesma lógica (revalidar contra o JSON real).

**Entrega:** custo de importação com IBS/CBS e flag de compensação, batendo com a simulação do PRD.

## Sprint 4 — Roteamento dinâmico + RAG com citação

**Objetivo:** aposentar o "modelo antigo" e tornar a citação verificável.

- [ ] Camada de roteamento de modelo por custo/latência/qualidade (substitui `nova-2-lite:free` fixo).
- [ ] Migrar RAG do File Search Store para `pgvector` (`norma_chunk`), com `norma`/`norma_relacao` semeadas do cosmético.
- [ ] Citação clicável na UI: "Base legal" abre o trecho da norma (pilar Confiança).
- [ ] Limiar de confiança → badge "revisão manual" quando abaixo.

**Entrega:** respostas mais baratas, citações abrem a norma, incerteza é honesta.

## Sprint 5 — Confiança na UI + trilha (pilares de UX do PRD §3.3)

**Objetivo:** os pilares que faltam para adoção em domínio regulado.

- [ ] Marca visual "sugerido pela IA" vs "validado pelo humano" nos campos do Veredito.
- [ ] Aprovação de plano antes de "Gerar Minuta de LI" (mostrar etapas, pedir confirmação).
- [ ] Desfazer / histórico de versões sobre `event_log`; edição granular de campo.
- [ ] Botão de parada + indicador de atividade autônoma em auditoria de lote.

**Entrega:** os 5 pilares de UX confiável cobertos.

## Transversal — Evals (H1–H4) e extensão de segmento

Rodando em paralelo a partir do Sprint 2:

- [ ] Dataset dourado por segmento; harness medindo H1 (custo/latência −30%), H2 (fidelidade ≥4,0), H3 (alucinação <5%), H4 (consistência entre versões normativas).
- [ ] **Fase 2 — Químico:** obter NCMs reais com despachante, curar anuência ANVISA/IBAMA (reaplicar pipeline do Sprint 1, sem redesenho).
- [ ] **Fase 3 — Agroquímico:** registro tripartite MAPA+ANVISA+IBAMA (prova final de escala).

## Dependências e caminho crítico

```
Sprint 0 ─► Sprint 1 ─► Sprint 2 ─► Sprint 3 ─► Sprint 4 ─► Sprint 5
   │            │                                   │
   └─ segredos  └─ dado real habilita tudo          └─ RAG habilita citação/evals
```

Bloqueios externos: percentuais IBS/CBS 2027+ e anuências de químico/agroquímico dependem de
validação com **despachante/tributarista** (pendência já registrada no PRD).
