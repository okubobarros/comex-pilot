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

**Resolvido:** o `server.ts` agora exporta o app Express e `api/index.ts` o expõe como função
serverless da Vercel (`vercel.json` roteia `/api/*` para ela e o resto para o SPA). Falta só
cadastrar as variáveis no painel da Vercel — ver `docs/ops/deploy.md`.

## ⚠️ Gotcha nº 3 — credencial do CONSOLE ≠ credencial do BANCO

Erro `Neo.ClientError.Security.Unauthorized` quase sempre é isto:

| | Login | Senha |
|---|---|---|
| **Console** (console.neo4j.io) | seu e-mail (ex.: `voce@gmail.com`) | senha da sua **conta** |
| **Banco** (`neo4j+s://...`) | **sempre `neo4j`** | senha **da instância** |

No `.env` vai SEMPRE a credencial **do banco**:
```
NEO4J_USER="neo4j"          # nunca o e-mail
NEO4J_PASSWORD="<senha da INSTÂNCIA>"
```

A senha da instância é mostrada **uma única vez**, na criação (e no arquivo
`.txt` que o Aura oferece para baixar). Se não a tiver, gere outra:

No **AuraDB Free não existe reset de senha pelo console** — a opção
`Recover Database Credentials` apenas abre a documentação. A senha é exibida
**uma única vez**, na criação da instância.

**Sem a senha, há dois caminhos (nesta ordem):**

**1. Trocar a senha pelo Query Studio** (rápido, preserva tudo)
O Query Studio do console conecta pela sua **sessão do console** — não pede a
senha do banco. Então dá para redefinir por lá:
`Open → Query` → trocar o database para **`system`** → executar:
```cypher
ALTER USER neo4j SET PASSWORD 'NovaSenhaForte2026';
```
Script pronto: `scripts/cypher/trocar_senha_aura.cypher`.

**2. Clonar a instância** (se o passo 1 der *permission denied*)
Menu `⋯` → **`Clone To`** → cria uma instância nova **com os dados** e mostra
as credenciais na criação. Depois é só apontar `NEO4J_URI` para a nova.

> 🚨 **NÃO clique em `Reset To Blank`** — fica logo acima no mesmo menu e
> **apaga o grafo inteiro** (158.678 nós / 317.962 relações). Nomes vizinhos,
> consequências opostas.

### Conectar pela extensão Neo4j do VS Code
| Campo | Valor |
|---|---|
| Display name | `sat-graph-rag` |
| **Scheme** | **`neo4j+s://`** (o default `neo4j://` falha — o Aura exige TLS) |
| **Host** | `785150a4.databases.neo4j.io` (só o host, sem esquema e sem porta) |
| Port | `7687` |
| User | `neo4j` |
| Password | a senha da instância |

Atenção: há **duas instâncias** na conta — `My instance` (`c36586f0`, vazia) e
`sat-graph-rag` (`785150a4`, com o grafo). A senha precisa ser a da **segunda**.

### Diagnóstico rápido
```bash
node -e "require('dotenv').config();const n=require('neo4j-driver');
const d=n.driver(process.env.NEO4J_URI,n.auth.basic(process.env.NEO4J_USER,process.env.NEO4J_PASSWORD));
d.getServerInfo().then(()=>console.log('OK')).catch(e=>console.log('FALHOU',e.code)).finally(()=>d.close())"
```
- `Unauthorized` → senha/usuário do banco errados (ver acima).
- Erro de DNS/timeout → URI errada ou instância pausada.

### Validar as queries sem a senha
O **Query Studio** do console (e a extensão Neo4j do VS Code) usam a sessão do
navegador — dá para rodar Cypher lá mesmo sem a senha do banco. Use
`scripts/cypher/validacao_sat_graph.cypher` para conferir labels/propriedades
reais antes de ligar o app.

## Regras (do prompt de integração)
- Não criar nós `NCMCode` nem rodar seeds/migrações no grafo (é produção).
- Não commitar `.env` com a senha. Não alterar constraints/índices no Neo4j.
