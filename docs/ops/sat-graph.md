# SAT-Graph RAG — motor de conformidade sobre o Neo4j

Integração do grafo de conformidade aduaneira (Neo4j Aura, instância `785150a4`, ~159k nós /
332k relações, 17+ órgãos anuentes ligados a NCM por `APLICA_SOBRE`) ao ComexPilot. **Somente
leitura** — o app nunca escreve no grafo.

## Como conectar (você faz — a senha não é commitada)

1. No `.env` da raiz, preencha (a instância já está no `.env.example`):
   ```
   NEO4J_URI="neo4j+s://785150a4.databases.neo4j.io"
   NEO4J_USER="neo4j"
   NEO4J_PASSWORD="<senha do Aura>"
   NEO4J_DATABASE="neo4j"
   ```
   > ⚠️ **Gotcha nº 1:** no Aura Free o database chama-se **`neo4j`** — o `785150a4` é a
   > *instância*, não o nome do banco. Se der `database does not exist`, mantenha `NEO4J_DATABASE=neo4j`.

2. Rode o servidor: `npm run dev` (o `tsx server.ts` carrega o `.env`).

3. Teste a conexão:
   ```bash
   curl http://localhost:3000/api/sat-graph/test
   ```
   Deve voltar `stats` (labels/contagens), `orgaos` (órgãos com regras NCM) e o exemplo do NCM
   `84709010`. Sem as variáveis, responde **503** limpo ("Neo4j não configurado").

## O que foi criado

```
server/neo4j.ts          # driver Aura (singleton) + query() somente-leitura
server/satGraph.ts       # queries: getTaPorNcm, getNcmInfo, getStats, getOrgaosAtivos
server/satGraphService.ts# handlers das rotas
server.ts                # GET /api/sat-graph/test  ·  GET /api/sat-graph/ncm/:code
src/components/compliance/ComplianceWorkspace.tsx  # UI: NCM → órgãos + TAs/LPCO
```
No app: **Dock → Conformidade** abre a consulta; digite um NCM → mostra os órgãos anuentes e os
tratamentos administrativos (TA/LPCO), com `impede_desembaraço`, modelo LPCO e base legal.

## Modelo consultado (não alterar)

`(TreatmentRule)-[:APLICA_SOBRE]->(:NCMCode {id:"NCM_CODE_<8 dígitos>"})`. Propriedades usadas:
`orgao_anuente`, `orgao_nome_normalizado`, `ta_id`, `codigo_modelo`, `nome_modelo_lpco`,
`tipo_ta`, `impede_desembaraco`, `prazo_validade_lpco`, `base_legal_ta`, `inicio_vigencia_ta`.

## NCMs para testar
| NCM | Produto | Órgão esperado |
|---|---|---|
| `30023060` | Vacina febre aftosa | MAPA |
| `84709010` | Máquinas de franquear | ECT |
| `71021000` | Diamantes brutos | ANM/DNPM (Kimberley) |
| `29042041` | Produto químico controlado | DPF/SIPROQUIM |
| `27160000` | Energia elétrica | ANEEL (alerta) |

## ⚠️ Gotcha nº 2 — produção

Diferente do custeio (função pura, roda no browser), o SAT-Graph **exige o servidor Express**
(o driver Neo4j e as credenciais são server-side; nunca vão para o browser). O deploy estático
atual da Vercel **não serve `/api/*`**, então a Conformidade só funciona:
- em **dev local** (`npm run dev`), ou
- num **deploy que rode o servidor Node** (ou uma serverless function que exponha as rotas).

Para produção, o passo seguinte é publicar o `server.ts` como função/serviço na Vercel (ou outro
host Node) com as variáveis `NEO4J_*` no ambiente.

## Regras (do prompt de integração)
- Não criar nós `NCMCode` nem rodar seeds/migrações no grafo (é produção).
- Não commitar `.env` com a senha. Não alterar constraints/índices no Neo4j.
