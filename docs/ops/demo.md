# Roteiro de demo — AI Native OS (para o time)

_O que dá para mostrar hoje. Tudo sobre **dado real** (base NCM, tributos, PTAX ao vivo,
normas), com os pontos provisórios claramente sinalizados._

## Setup (2 min)

1. **Aplicar o seed das fases futuras** no Supabase (SQL editor) — só uma vez:
   `seeds/0003_ibs_cbs_fases.sql`. (Os demais — schema, RLS, seeds, ETL — você já rodou.)
2. **`.env`** na raiz com a connection string direta do Supabase:
   ```
   DATABASE_URL="postgres://postgres:[SENHA]@db.[SEU-PROJETO-REF].supabase.co:5432/postgres"
   ```
3. Rodar: `npm run dev` → abrir `http://localhost:3000`. (Tela cheia, largura ≥ 1024px
   para as 3 colunas.)

## Roteiro (7–8 min) — a ordem importa

**1. "Isto é um sistema operacional, não um site" (30s)**
Na home: **TopBar** (cliente · Time Machine · Confiança), **Dock de 5 agentes** embaixo,
**Painel de Evidências** à direita, e o **Centro de Operações como Kanban** (Pendente /
Em Análise / Concluído) com processos reais e o agente responsável de cada um.

**2. Câmbio ao vivo (30s)**
Dock → **Custeio**. Repare que o campo de câmbio já veio preenchido com a **PTAX do dia**
(API do Banco Central) — não é número digitado à mão.

**3. Custeio com alíquota real (1 min)**
Preencher **NCM `3304.99.90`**, **FOB `10000`** → avançar → **Calcular**. Aparece o bloco
"Motor de custeio · alíquotas reais": II 18% / IPI 14,3% / ICMS 18% / AFRMM 25% vindos do
banco, CTI e **IBS/CBS a declarar · compensável (impacto R$ 0)**.

**4. 🎯 A Time Machine (o momento "uau") (1 min)**
No topo, trocar **Jan/2026 → Jan/2027**. Sem recarregar, **tudo recalcula**: PIS/COFINS/IPI
vão a **R$ 0**, CBS salta para **8,8%**, e o impacto de caixa sai de R$ 0 (compensável) para
**~R$ 4.500** (badge muda para "provisório"). É a Reforma Tributária como *dado versionado*,
não como texto.

**5. Painel de Evidências (45s)**
À direita, o painel mostra o **raciocínio do agente** (passos com as alíquotas reais) e a
**base normativa**. Clicar em **"LC 214/2025"** → abre a **ementa oficial** vinda do banco
(`mcat.norma`). Confiança = citação verificável, não "confie em mim".

**6. Auditoria em 3 colunas (2 min)**
Dock → **Auditor** → pill **"Auditar Invoice de Cosméticos (Coreia)"**. O veredito abre em
**3 painéis**: *Documento* (FOB, itens, NCM) · *Bloqueios* (accordion — clicar em
**"RDC 752/2022"** puxa o texto real da norma; **checkbox "Validação humana"** = controle) ·
*Minuta de LI* (Baixar XML / Assinar).

## O que é real × provisório (para diligência honesta)

| Real | Provisório / mock |
|---|---|
| Base NCM (15.156), tributos federais (10.512), ICMS/Siscomex | Percentuais IBS/CBS de **2027+** (mecânica correta, alíquota a validar com tributarista) |
| Câmbio PTAX ao vivo (API BCB) | Ações "Baixar XML" / "Assinar" (placeholder) |
| Alíquotas 2026 (LC 214/2025, oficial) | Processos do Kanban (estado de demonstração) |
| Textos de norma (LC 214, RDC 752/907…) via `mcat.norma` | Extração de Invoice (usa presets/Gemini) |

## Mapa para o PRD (fala de pitch)
- **5 camadas**: Extração/Conciliação (Auditor) · Raciocínio (Classificador/Custeio) ·
  Justificativa (Evidências + citações) · Roteamento (Dock de agentes).
- **5 pilares**: Confiança (citação clicável) · Clareza (chain-of-thought) · Controle
  (checkbox de validação humana) · Transparência (Time Machine + provisório sinalizado) ·
  Benefício (atalhos de intenção, próxima ação contextual).
