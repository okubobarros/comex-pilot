# Deploy — servidor + API na Vercel

Até aqui a Vercel servia **só o front estático**, então `/api/*` não existia em produção
(custeio real, PTAX, citações e SAT-Graph só funcionavam em dev). Isto resolve.

## Como funciona

```
vercel.json     → buildCommand: vite build · outputDirectory: dist
                  rewrites: /api/*  → função serverless
                            /*      → index.html (SPA)
api/index.ts    → exporta o MESMO app Express do server.ts
server.ts       → export default app; só chama listen() fora da Vercel
                  (vite virou import dinâmico, carregado apenas em dev)
```
Uma fonte de verdade: as rotas são registradas uma vez e valem para dev e produção.

## Variáveis de ambiente (cadastrar no painel da Vercel)

**Project → Settings → Environment Variables** (marque *Production* e *Preview*):

| Variável | Valor | Para quê |
|---|---|---|
| `NEO4J_URI` | `neo4j+s://785150a4.databases.neo4j.io` | SAT-Graph (conformidade) |
| `NEO4J_USER` | `neo4j` | idem — **nunca** o e-mail do console |
| `NEO4J_PASSWORD` | senha da instância `sat-graph-rag` | idem |
| `NEO4J_DATABASE` | `neo4j` | opcional (o app resolve sozinho) |
| `DATABASE_URL` | connection string do Supabase | custeio/normas com o banco completo |
| `GEMINI_API_KEY` | chave do Gemini | análise de invoice (sem ela, modo simulado) |

`BCB_PTAX_BASE` tem default no código — não precisa cadastrar.

> Sem `DATABASE_URL`, o custeio continua funcionando pelo **fallback client-side**
> (dados do piloto embutidos). Sem `NEO4J_*`, a aba Conformidade responde 503 explicando.

## Depois de cadastrar

Faça um redeploy (ou um push) e valide:
```bash
curl https://comex-pilot.vercel.app/api/ptax
curl https://comex-pilot.vercel.app/api/sat-graph/test
```

## Dev local não muda
`npm run dev` continua subindo Express + Vite na porta 3000, como antes.
