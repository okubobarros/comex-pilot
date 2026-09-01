# Motor de Conformidade (SAT-Graph) — análise do estado atual

_Auditoria técnica da feature, feita por inspeção do código e validação em produção._
_Data: 01/09/2026 · Base: branch `main`._

---

## ⚠️ Correção de premissa: a tela de Conformidade NÃO usa mocks

A pergunta que originou esta análise partia de "onde estão os dados mockados
(2933.39.99, ANVISA, DECEX, DFPC, DPF, MAPA, MCT, modelos LPCO)". **Esses dados
não são mockados** — vêm do Neo4j (SAT-Graph) em tempo real:

```
GET https://comex-pilot.vercel.app/api/sat-graph/ncm/29333999
→ 6 órgãos anuentes · 15 tratamentos · base legal "Art. 8º da Lei 9782/99"
```

As únicas ocorrências de "ANVISA/DECEX" em `ComplianceWorkspace.tsx` são **texto
de placeholder** (linhas 88 e 159), sugerindo NCMs de exemplo ao usuário.

**Onde há mock de verdade** (outras telas, não a Conformidade):

| Arquivo | O que mocka | Consumido por |
|---|---|---|
| `src/data/mockScenarios.ts` | `PRESET_SCENARIOS`, `DEFAULT_NCM_RULES` | Auditoria (pills de demo) |
| `src/context/ProcessContext.tsx` | 6 processos do Kanban | Home |
| `src/engine/offline.ts` | alíquotas do piloto (fallback sem backend) | Custeio |
| `src/data/cosmeticsDb.ts` | base de cosméticos | Auditoria (backend) |

---

## 1. Arquitetura e componentes

### Camadas

```
src/components/compliance/ComplianceWorkspace.tsx   ← a tela
        │ fetch('/api/sat-graph/ncm/:code')
        ▼
server/app.ts                    ← registra as rotas (Express)
server/satGraphService.ts        ← handler HTTP + diagnóstico de config
server/satGraph.ts               ← Cypher + normalização por órgão
server/neo4j.ts                  ← driver Aura (somente leitura)
        ▼
Neo4j Aura (c36586f0) — 158.678 nós / 317.962 relações
```

### Gestão de estado

**Não há Zustand nem Redux.** O app usa **React Context + useState local**:

| Contexto | Arquivo | Escopo |
|---|---|---|
| `DateProvider` | `src/context/DateContext.tsx` | Time Machine (fase IBS/CBS) |
| `ProcessProvider` | `src/context/ProcessContext.tsx` | processos do Kanban |
| `EvidenceProvider` | `src/context/EvidenceContext.tsx` | chain-of-thought + citações |

Os três são montados em `src/main.tsx`, acima de `<App/>`.

O `ComplianceWorkspace` tem **apenas estado local** — 4 `useState` (`ncm`, `data`,
`erro`, `loading`) — e **não consome nenhum contexto**. Essa é a raiz de vários
problemas da seção 3.

### Estrutura de dados na tela

```ts
interface Tratamento {           // uma regra de um órgão
  orgao_label, orgao_npi, ta_id, tipo_ta, modelo,
  impede_desembaraco, prazo, base_legal, vigencia
}
interface Resultado {
  ncm: { codigo, descricao }, tratamentos: Tratamento[], total_orgaos: number
}
```

O agrupamento por órgão é feito **no cliente**, com `reduce` sobre `orgao_npi`
(linhas 60-65).

---

## 2. Fluxo de dados (do clique ao render)

1. Usuário digita o NCM e clica **Consultar** → `consultar()`
2. `fetch('/api/sat-graph/ncm/' + digits)` — sem cache, sem debounce
3. `server/satGraph.ts` monta o id: `NCM_CODE_<8 dígitos>`
4. Cypher: `MATCH (rule)-[:APLICA_SOBRE]->(:NCMCode {id})`
5. **Normalização por órgão** — cada agência tem schema diferente:
   - DECEX/INMETRO/IBAMA: `orgao_anuente`, `ta_id`, `tipo_ta`, `impede_desembaraco`
   - ANVISA: `categoria_regulatoria`, `fundamentacao_legal`, `lpco_unico`
   - MAPA: `descricao`, `procedimento_i/ii/iii`

   Resolvido com `coalesce` + `orgaoDoLabel()` (deriva o órgão do label do nó)
6. A descrição do NCM vem de `NCMOccurrence` (join por `code_canonical`)
7. Resposta → `setData()` → agrupamento por órgão → render

### Endpoints ativos

| Rota | Função | Estado |
|---|---|---|
| `GET /api/sat-graph/ncm/:code` | conformidade por NCM | ✅ produção |
| `GET /api/sat-graph/test` | health + stats do grafo | ✅ produção |
| `POST /api/costing` | custeio (Postgres) | ✅ |
| `GET /api/ptax` | câmbio BCB | ✅ |
| `GET /api/norma` | ementa para citação | ✅ |

---

## 3. Pontos cegos de UX — por que a tela parece estática

Confirmados por inspeção do código, não por impressão:

### 🔴 P1 — O Painel de Evidências não reage à Conformidade

`grep "setEvidence" src/components/compliance/` → **zero ocorrências**.
Só `App.tsx` (auditoria) e `LandedCostDrawer.tsx` (custeio) alimentam a trilha.

**Efeito:** o usuário consulta 6 órgãos e o painel direito continua vazio ou
mostrando o raciocínio de outro agente. Quebra o pilar *Clareza* do PRD.

### 🔴 P2 — Os cards de tratamento não são clicáveis

`onClick` aparece **2×** no arquivo: apenas *Consultar* e *Fechar*.
Cada TA é uma `<div>` inerte — sem expansão, seleção ou detalhe. O
`AuditWorkspace` já faz isso com accordion; a Conformidade não.

### 🔴 P3 — A base legal não é clicável (inconsistência interna)

Na Conformidade a base legal é **texto plano** (`<p>`); no `AuditWorkspace` o
mesmo dado é **botão que abre a ementa** via `/api/norma`. Duas telas, dois
comportamentos para o mesmo tipo de informação.

### 🔴 P4 — Nenhuma ação de saída

Não há *Gerar Minuta*, *Exportar XML/PDF*, *Enviar ao despachante* nem
*Adicionar ao processo*. A tela é um **beco sem saída**: informa e encerra.
O PRD (§3.3, "botões de próxima ação contextual") pede o oposto.

### 🟡 P5 — Sem persistência nem histórico

O resultado vive em `useState`; trocar de agente no Dock **descarta tudo**.
Não alimenta o `ProcessContext` nem grava em `mcat.processo`.

### 🟡 P6 — Sem hierarquia visual de risco

`impede_desembaraco` recebe um badge discreto, mas a tela **não ordena nem
destaca** o que impede desembaraço. Um bloqueio crítico da ANVISA aparece com o
mesmo peso de um alerta informativo.

### 🟡 P7 — Campos nulos não são tratados

ANVISA e MAPA não têm `ta_id` no grafo → o badge renderiza vazio. Falta fallback
(mostrar `rule_id` ou omitir o badge).

### 🟢 P8 — Menores

Sem debounce/cache (cada clique = round-trip); sem validação de formato de NCM;
os "NCMs sugeridos" são texto morto (não clicáveis); loading sem skeleton.

---

## 4. Arquivos relevantes

| Arquivo | Papel | Tamanho |
|---|---|---|
| `src/components/compliance/ComplianceWorkspace.tsx` | a tela | ~165 linhas |
| `src/components/os/EvidencePanel.tsx` | painel direito (não recebe dados daqui) | ~130 |
| `src/context/EvidenceContext.tsx` | trilha de evidências | ~45 |
| `src/components/os/AgentDock.tsx` | entrada (agente "Conformidade") | ~65 |
| `src/App.tsx` | roteia `workspaceMode === 'compliance'` | — |
| `src/components/Workspace.tsx` | delega ao ComplianceWorkspace | — |
| `server/satGraph.ts` | Cypher + normalização | ~102 |
| `server/satGraphService.ts` | handlers HTTP | ~52 |
| `server/neo4j.ts` | driver + resolução de database | ~72 |

---

## 5. Recomendação de prioridade

Ordenado por **impacto na percepção de "produto real"** ÷ esforço:

| # | Ação | Esforço | Por quê |
|---|---|---|---|
| 1 | Alimentar o Evidence Panel (`setEvidence`) na consulta | baixo | O painel já existe e funciona — é só ligar. Ganho imediato de coerência |
| 2 | Base legal clicável (reusar o padrão do AuditWorkspace) | baixo | Código já existe em outra tela; elimina inconsistência |
| 3 | Cards expansíveis (accordion) + destaque de `impede_desembaraco` | médio | Transforma lista estática em exploração |
| 4 | Ação "Gerar Minuta de LI" a partir de um TA da ANVISA | médio | Fecha o ciclo detectar → resolver; o `LiMinutaModal` já existe |
| 5 | Persistir consulta no ProcessContext / `mcat.processo` | médio | Alimenta o Kanban; dá continuidade entre agentes |

Os itens 1 e 2 são **reuso de componentes já prontos** — sessão curta cada, com
ganho desproporcional de percepção.
