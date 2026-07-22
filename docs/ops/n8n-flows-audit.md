# Fluxos n8n legados — referência de lógica e proposta de melhoria

_Os dois workflows n8n (`Classificador_fiscal`, `Custos CTI`) têm **mais de um ano** e **não serão
reaproveitados**. Servem como **referência da lógica** que usávamos — não como base de código a
manter. Este documento extrai o que era feito e propõe a versão simplificada que os substitui._

## Decisão (CEO)

- **Não rotacionar / não manter.** As credenciais embutidas nos exports (chave Gemini, `service_role`
  Supabase) são de uma versão antiga e **não estão mais em uso** — serão **descartadas**. Não há
  ação de segurança pendente; apenas **não commitar os arquivos de export** no repositório.
- Os fluxos entram aqui só como **memória de lógica**. A implementação nova nasce no backend do app,
  não em n8n.

## O que os fluxos faziam (lógica a preservar conceitualmente)

**`Classificador_fiscal` (classificação por RAG):**
`Webhook → agente RAG (busca em documentos indexados) → JSON estruturado {ncm, descrição, fundamento_legal, confiança} → log`.
- **Bom que fica:** saída estruturada com `confiança` e `fundamento_legal`; a ideia de tool de busca.
- **Ruim que sai:** RAG preso ao File Search Store do Gemini; modelo fixo gratuito; UUID de sessão
  gerado por hack; segredos inline; sem persistência da decisão/citação.

**`Custos CTI` (custeio):**
`extrai NCM → busca ICMS/AFRMM → cotação de câmbio via Perplexity → calcula CTI → grava no Supabase`.
- **Bom que fica:** a sequência de custeio (VMLD→II→IPI→PIS→COFINS→AFRMM→Siscomex→ICMS).
- **Ruim que sai:** câmbio via Perplexity (instável); fórmula fixa sem IBS/CBS; alíquotas buscadas de
  forma dispersa; modelo antigo.

## Proposta de melhoria — o que construímos no lugar

Em vez de dois workflows n8n acoplados, **três agentes stateless** no backend do app, lendo as mesmas
tabelas Postgres e expondo contratos de API limpos. Simplificação central: **dado versionado no banco
substitui lógica hardcoded**, e **um roteador de modelo** substitui o modelo fixo.

```
Centro de Operações (app)
     │ intenção (classificar | custear | auditar)
     ▼
Roteador de modelo ──► Agente Classificador   → pgvector (normas) + tabela ncm  → decisão + citação
                  ──► Agente Custeio          → função versionada (ncm_tributo, ibs_cbs_regra, icms_uf, siscomex, cambio_ptax)
                  ──► Agente Auditoria         → encadeia extração + conciliação + os dois acima
                                    │
                                    ▼
                         Postgres (tabelas compartilhadas) + event_log (trilha append-only)
```

| Antes (n8n legado) | Depois (proposta) |
|---|---|
| RAG no File Search Store do Gemini | RAG em **pgvector** sobre normas curadas, com citação ligada à tabela `norma` |
| Câmbio via Perplexity | Tabela `cambio_ptax` (PTAX/BCB oficial) com fallback |
| Fórmula de custeio fixa (só modelo antigo) | Função `custeio(...)` **versionada por data do fato gerador** (as-is + IBS/CBS) |
| Alíquotas buscadas ad-hoc | Tabelas de referência únicas (`ncm_tributo`, `icms_uf`, `siscomex_taxa`) |
| Modelo fixo gratuito | **Roteamento dinâmico** por custo/latência/qualidade |
| Segredos inline, sem persistência | Credenciais em env; decisão + citação em `decisao`; trilha em `event_log` |
| 2 workflows acoplados | 3 agentes desacoplados e invocáveis isoladamente (PRD §4.0) |

**Ganho:** menos peças móveis, dado auditável, custeio correto na Reforma, citação verificável — e
cada agente pode ser chamado sozinho (tarefa avulsa) ou encadeado (auditoria completa).

Detalhes de implementação: motor em [../architecture/costing-engine.md](../architecture/costing-engine.md),
dados em [../architecture/data-model.md](../architecture/data-model.md).
