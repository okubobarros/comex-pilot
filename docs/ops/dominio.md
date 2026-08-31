# Domínio comexpilot.com — mover para o repo/projeto atual

## Situação (diagnosticada em 29/08/2026)

| Item | Estado |
|---|---|
| DNS da zona `comexpilot.com` | **Cloudflare** (`margot.ns` / `glen.ns.cloudflare.com`) |
| `www.comexpilot.com` | CNAME → `c3fcd3f114a5ec08.vercel-dns-017.com` (Vercel) |
| `app.comexpilot.com` | CNAME → mesmo alvo (Vercel) |
| Projeto Vercel que detém os domínios | **`comexpilotv1`** (repo `okubobarros/comexpilotv1`) |
| Projeto deste repo | **`comex-pilot`** (`comex-pilot.vercel.app`) |

**O DNS já está certo — não precisa mexer no Cloudflare.** O conflito é interno
à Vercel: um domínio só pode pertencer a **um** projeto por vez. Tentar
adicioná-lo no projeto novo sem remover do antigo retorna
*"Domain is already in use by another project"*.

## Procedimento (a ordem importa)

1. **Projeto antigo** `comexpilotv1` → Settings → Domains → **remover**
   `app.comexpilot.com` (e `www.comexpilot.com`, se estiver lá).
2. **Projeto novo** `comex-pilot` → Settings → Domains → **Add** `app.comexpilot.com`.
   A validação é automática: o CNAME no Cloudflare já aponta para a Vercel.
3. Repetir para `www.comexpilot.com`. Opcional: adicionar o apex `comexpilot.com`
   como redirect para `www`.
4. **Cadastrar as variáveis de ambiente** no projeto novo (Settings → Environment
   Variables) — sem elas o site abre, mas Conformidade/custeio não funcionam.
   Ver [deploy.md](deploy.md).
5. **Redeploy** (Deployments → ⋯ → Redeploy): variáveis novas só entram em build novo.

## Cuidados

- **Cloudflare proxy:** os registros `app`/`www` devem ficar em **DNS only**
  (nuvem cinza). Com o proxy laranja sobre a Vercel é comum dar erro de
  certificado ou loop de redirect.
- **Propagação:** como o CNAME não muda, a troca é quase instantânea. Pode haver
  segundos de indisponibilidade entre remover e adicionar.
- **Projeto antigo:** depois de validar, pode ser pausado/arquivado — mas só
  depois que `app.comexpilot.com` estiver servindo o app novo.

## Render — quando faria sentido

Não é necessário hoje: o backend já roda como função serverless na Vercel
(`api/index.ts` + `vercel.json`). Render (ou outro host Node) só se justifica se
aparecer necessidade de **servidor persistente** — cold start prejudicando as
conexões Neo4j/Postgres, WebSockets ou jobs longos. Nesse caso o `server.ts` já
funciona como servidor tradicional (`npm run build && npm start`), bastando
apontar o DNS para o novo host.
