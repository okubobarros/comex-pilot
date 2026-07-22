# MCAT / ComexPilot — Documento Mestre de Produto

> **Visão, Arquitetura e Roadmap.** Preparado para a candidatura ao Gama Fund
> (Monashees × Google AI Futures Fund).
>
> _Cópia canônica versionada no repositório. Fonte original: `PRD_Mestre_MCAT_ComexPilot.docx`._
> _Convertido para markdown em 2026-07-21. Ao atualizar o produto, atualize este arquivo._

---

## Parte 1 — Visão e oportunidade

### 1.1 O problema

O comércio exterior brasileiro opera sob elevada burocracia, múltiplos órgãos anuentes e alto
Custo Brasil — o que torna a importação um processo fragmentado, opaco e de difícil auditoria. A
"caixa-preta" que resolvemos não é a de um modelo de IA: é a opacidade de toda a cadeia decisória
do comex — a conferência documental prévia, a classificação fiscal, a identificação de anuências e
o custeio, hoje dependentes de interpretação manual e dispersa entre especialistas.

### 1.2 Por que agora

Três janelas convergem no mesmo momento:

- **Novo Processo de Importação (NPI)** — consolidação da DUIMP, reorganizando a lógica de registro
  de importação no Brasil.
- **Reforma Tributária (IBS/CBS)** — Lei Complementar 214/2025 e 227/2026, com fase de teste ativa
  desde janeiro de 2026 e transição até 2033.
- **Maturidade de IA agêntica** — arquiteturas multiagente com Graph-RAG e roteamento dinâmico
  atingiram, pela primeira vez, explicabilidade suficiente para operar em domínio de alta
  consequência regulatória. O EU AI Act (vigente desde agosto de 2026) formaliza exatamente os
  requisitos — rastreabilidade, explicabilidade, supervisão humana — que esta arquitetura já
  entrega por desenho.

### 1.3 Visão de produto

Investigar e construir uma arquitetura multiagente que transforma a cadeia de conformidade
aduaneira e tributária em um processo rastreável, justificável e defensável — testada primeiro no
Brasil, com potencial de expansão para a América Latina.

---

## Parte 2 — Mercado e segmentos

### 2.1 Tamanho de mercado

_Fonte: Cadastro Aduaneiro de Intervenientes da Receita Federal (18/02/2025)._

| Segmento | Quantidade | Mercado |
|---|---|---|
| Importadores (médio/grande porte) | ~5.000 empresas | R$100M–250M |
| Despachantes Aduaneiros | 11.316 profissionais | R$56M–170M |
| Escritórios de Advocacia (Comex) | ~500 | R$7,5M–20M |
| Trading Companies | ~200 | R$10M–40M |
| **TAM Total** | | **R$173M–480M** |

### 2.2 Os três segmentos-piloto, por complexidade regulatória crescente

A estratégia de produto escala deliberadamente por complexidade — provando a arquitetura no caso
mais simples antes de estender ao mais difícil, sem redesenho:

| Ordem | Segmento | Órgãos anuentes | Status do conhecimento |
|---|---|---|---|
| 1 | Cosmético | ANVISA (isolado) | ✅ Mapeado — RDC 16/2014 (AFE), RDC 752/2022 (definição), RDC 949/2024 (Grau 1/2), RDC 907/2024 (rotulagem) |
| 2 | Químico | ANVISA e/ou IBAMA, a depender do produto | ⚠️ Parcial — tributos mapeados (II/IPI/PIS/COFINS reais por NCM), anuência específica pendente de validação |
| 3 | Agroquímico | MAPA + ANVISA + IBAMA (registro tripartite, Lei 7.802/89) | 🔲 A mapear — caso de maior complexidade multiagência, usado para provar que a arquitetura escala sem redesenho |

Essa progressão (1 órgão → 1-2 órgãos → 3 órgãos simultâneos) é, por si, a demonstração prática de
por que uma arquitetura multiagente é necessária — não um checklist.

### 2.3 Concorrência

Logcomex, eComex/Veritas e Sigraweb (Brasil); Altana AI (EUA), Cleo Labs (França) e Flexport (EUA)
no mercado global. Nenhum concorrente identificado combina roteamento dinâmico, trilha de
evidências e versionamento normativo tributário no domínio aduaneiro brasileiro.

---

## Parte 3 — Experiência do usuário

### 3.1 Personas e Jobs-to-be-Done

- **Despachante Aduaneiro** — "Quando recebo um novo pacote de documentos, quero verificar
  rapidamente se os campos batem entre Invoice, Packing List e BL, para registrar a DUIMP sem risco
  de autuação."
- **Agente de Carga** — "Quando transmito dados ao Siscarga, quero validação automática dos campos
  críticos, para não travar o registro da DI/DUIMP do cliente."
- **Importador / Trading** — "Quando planejo uma compra internacional, quero saber o custo total já
  considerando o IBS/CBS, para precificar corretamente sem surpresas."

### 3.2 Jornada do usuário — implementada no ComexPilot

O ComexPilot (comex-pilot.vercel.app), já em construção, materializa esta jornada em três telas
centrais:

- **Centro de Operações** — "O que você precisa resolver hoje?": três frentes de entrada (Validar
  uma operação, Calcular custos, Consultar informações), cada uma com atalhos diretos (Auditar
  documentos, Calcular custo de importação, Classificar produto).
- **Painel de Comando conversacional** — interface de chat com atalhos de intenção (Auditar Invoice,
  Classificar NCM, Risco Aduaneiro), já operando com Gemini.
- **Veredito da Auditoria** — resultado estruturado: score de risco, lista de bloqueios com base
  legal citada, impacto financeiro estimado e plano de ação — incluindo ação direta ("Gerar Minuta
  de LI Automatizada").

Cada bloqueio mostra base legal, impacto e plano de ação lado a lado — é a materialização visual da
trilha de evidências, não uma detecção de erro isolada.

### 3.3 Cinco pilares de UX para IA confiável — requisitos de tela

**Confiança**
- Citações clicáveis, não só texto — "Base legal" deve abrir em tooltip/painel com o trecho da norma.
- Honestidade sobre limitação — abaixo do limiar de confiança, dizer explicitamente "revisão manual necessária".
- Identificação IA vs. humano — marca visual distinguindo "sugerido pelo MCAT" de "validado pelo despachante".
- Aprovação de plano antes da execução — "Gerar Minuta" mostra o plano de etapas antes de disparar.

**Clareza**
- Streaming da resposta no Painel de Comando.
- Raciocínio explícito (chain of thought) do agente regulatório.
- Destaque de mudanças (antes/depois) ao reclassificar NCM ou corrigir valor.

**Controle**
- Botão de parada visível para qualquer ação autônoma.
- Desfazer / histórico de versões (coerente com a trilha append-only).
- Edição granular — corrigir só o NCM ou só a alíquota sem re-rodar a auditoria inteira.

**Transparência**
- Permissões explícitas por ação ("ler e sinalizar" ≠ "gerar e submeter minuta").
- Estimativa de tempo e custo antes de rodar.
- Indicador visual de atividade autônoma.

**Benefício real**
- Fim da caixa de texto vazia — atalhos de intenção prontos (já resolvido no Centro de Operações).
- Botões de próxima ação contextual ("Enviar para o despachante", "Gerar relatório PDF", "Registrar exceção").

### 3.4 Jornada de exceção

Quando a confiança está abaixo do limiar, ou quando há conflito de competência entre órgãos
anuentes (ex.: insumo de origem vegetal com potencial dupla anuência ANVISA/MAPA, já contemplado na
UI), o sistema sinaliza o risco explicitamente em vez de arriscar uma recomendação de baixa confiança.

---

## Parte 4 — Arquitetura do sistema

### 4.0 Agentes independentes, não um pipeline rígido

Um erro comum em produtos de IA agêntica é forçar o usuário a rodar o processo completo mesmo
quando só precisa de uma resposta pontual. Referência de mercado: o **Harvey** (IA jurídica) não
entrega um agente único que faz tudo — entrega produtos separados por nível de compromisso.

**Implicação de arquitetura:** cada camada (extração, conciliação, raciocínio regulatório,
justificativa) deve ser exposta como um agente **independente e invocável isoladamente**, não apenas
como etapa de um pipeline fixo. O roteamento dinâmico decide, a cada solicitação, se chama um agente
sozinho (tarefa avulsa) ou encadeia vários (auditoria completa).

| Harvey | Nível de compromisso | Equivalente no MCAT |
|---|---|---|
| Assistant (chat aberto) | Baixo — uma pergunta | Painel de Comando conversacional |
| Knowledge (pesquisa com citação) | Baixo-médio — consulta pontual | "Consultar NCM", "Verificar antidumping", "Classificar produto" |
| Workflow Agents (tarefa reutilizável) | Variável | "Calcular custo de importação", "Calcular frete" |
| Vault (análise em lote, processo completo) | Alto — end-to-end | "Auditar documentos" / auditoria completa das 5 camadas |

### 4.1 As cinco camadas

| Camada | Função |
|---|---|
| Extração Semântica | OCR + parsing de Invoice, Packing List, BL, DUIMP |
| Conciliação Documental | Comparação cruzada entre documentos; detecção de divergências (ex.: subfaturamento por preço abaixo da referência aduaneira) |
| Raciocínio Regulatório | Consulta ao Graph-RAG — grafo normativo versionado + banco vetorial |
| Justificativa | Trilha auditável com citação de fonte normativa e verificação anti-alucinação |
| Roteamento Dinâmico | Seleção do modelo de linguagem por custo, latência e qualidade |

### 4.2 Stack já validada em protótipo

| Componente | Implementação atual |
|---|---|
| Orquestração | n8n (self-hosted, gratuito) |
| Modelo de linguagem | `amazon/nova-2-lite-v1:free` via OpenRouter |
| Classificação fiscal | Workflow `Classificador_fiscal` — upload → file search store → agente RAG (Gemini) → resposta estruturada |
| Cálculo de custo | Workflow `Agente Custos CTI` — extração de NCM → busca ICMS/AFRMM → câmbio (Perplexity) → cálculo → Supabase |

Esses dois workflows são o ponto de partida real da engenharia — não protótipos descartáveis, mas a
base sobre a qual a arquitetura de 5 camadas será formalizada.

### 4.3 Motor de custeio — as-is vs. to-be

Ver detalhamento em [../architecture/costing-engine.md](../architecture/costing-engine.md).

**Como é hoje (modelo antigo, ainda em vigor):**
`VMLD (valor aduaneiro) → II → IPI → PIS → COFINS → AFRMM → Taxa Siscomex → ICMS ("por dentro") → CTI`

**Como fica com IBS/CBS (2026 em diante):** o IBS/CBS não substitui a fórmula de uma vez — convive
com ela, com regra de transição por ano.

| Ano | Regra | O motor precisa registrar |
|---|---|---|
| 2026 (fase atual) | CBS 0,9% + IBS 0,1%, compensáveis com PIS/COFINS (LC 214/2025, art. 348, I) | Calcular e declarar os dois novos tributos; desembolso real ainda segue o modelo antigo |
| 2027 | PIS/COFINS extintos; CBS passa a valer cheia; IPI zerado (exceto ZFM) | Transição de regra — desembolso real muda |
| 2029–2033 | ICMS/ISS reduzem 10%/ano; IBS sobe na mesma proporção | Tabela de percentual de transição por ano |

**Simulação real** (creme hidratante, NCM 3304.99.90, FOB US$10.000):

| Item | Valor |
|---|---|
| CTI — desembolso real (modelo atual, 2026) | R$ 104.770,34 |
| CBS a declarar (0,9%) | R$ 524,28 |
| IBS a declarar (0,1%) | R$ 58,25 |
| Impacto de caixa adicional em 2026 | R$ 0,00 (compensável) |

**Implicação de arquitetura:** o motor de custeio precisa do mesmo desenho de versionamento temporal
já previsto para o grafo normativo — um campo de **data do fato gerador** e uma flag **compensável**
por tributo, não uma reescrita de fórmula a cada mudança de fase.

### 4.4 Schema de dados (entidades centrais)

```
Processo(id, cliente_id, status, canal)
Documento(id, processo_id, tipo, conteudo_extraido, hash)
Divergencia(id, processo_id, tipo, severidade)
Norma(id, tipo, orgao_emissor, vigencia_inicio, vigencia_fim)
NCM(codigo, descricao, aliquotas{II,IPI,PIS,COFINS,IBS,CBS}, exigencias_anuencia[])
OrgaoAnuente(id, nome, tipo_exigencia)
AliquotaIBSCBS(ncm, estado, vigencia_inicio, vigencia_fim, valor, compensavel)
Decisao(id, processo_id, recomendacao, justificativa, citacoes[], nivel_confianca)
```

Detalhamento e DDL em [../architecture/data-model.md](../architecture/data-model.md).

### 4.5 Guardrails

Verificação de citação normativa antes de exibição; supervisão humana obrigatória em decisões de
alto risco; limiar de confiança com escalonamento automático; sanitização contra prompt injection em
documentos de terceiros; escopo explícito (apoio à decisão, não opinião jurídica formal); proteção
de dados conforme LGPD.

### 4.6 Evals

- **H1** — redução de custo/latência via roteamento dinâmico (meta ≥30%).
- **H2** — fidelidade da justificativa (escala Likert, meta ≥4,0).
- **H3** — taxa de alucinação em citação (meta <5%).
- **H4** (exploratória) — consistência entre versões normativas simultâneas na transição tributária.

---

## Parte 5 — Base de conhecimento e fontes de dados

### 5.1 Fontes já incorporadas

| Fonte | Volume | Uso |
|---|---|---|
| Tabela NCM vigente (Receita Federal/CAMEX) | 15.161 códigos, vigente 21/07/2026 | Classificação fiscal |
| Tabela de tributos por NCM | 10.520+ linhas (II, IPI, PIS, COFINS, tratamentos administrativos) | Base do motor de custeio |
| Tabela ICMS/AFRMM por UF | 27 estados | Cálculo de custeio regional |
| Tabela Siscomex (por nº de adições) | Tabela oficial de taxas | Custeio |
| Câmbio histórico USD/BRL, EUR/BRL | Série diária | Conversão de VMLD |
| ANVISA — biblioteca temática Portos/Aeroportos/Fronteiras | 1.116 normas vigentes (recorte de 162.830 atos) | Anuência cosmético |
| Legislação tributária (LC 214/2025, LC 227/2026, Decreto 12.955/2026, Resolução CGIBS 6/2026) | — | Base do IBS/CBS |

### 5.2 Princípio de construção — não ingerir o corpo inteiro

Dado o volume, a base de conhecimento não tenta cobrir tudo de uma vez: cura-se manualmente o
subconjunto de cada segmento-piloto primeiro (cosmético → químico → agroquímico), depois
generaliza-se o pipeline de ingestão para os três, evitando três pipelines distintos.

### 5.3 Status de cobertura por segmento

- **Cosmético:** pronto — 4 normas-chave mapeadas, tributos reais carregados, simulação completa validada.
- **Químico:** tributos reais carregados; anuência específica (ANVISA/IBAMA) pendente de validação.
- **Agroquímico:** a mapear — caso mais complexo (registro tripartite MAPA+ANVISA+IBAMA), prova final de escala.

---

## Parte 6 — Roadmap consolidado

### To-do list imediato (do PRD)

- ☐ Atualizar workflow **Agente Custos CTI** (n8n) para incluir CBS/IBS com flag de compensação.
- ☐ Criar tabela de **regras de transição IBS/CBS** (2026 teste → 2027 plena → 2029-33 transição → 2033 definitivo).
- ☐ Levar ao despachante/tributarista a lista de NCMs reais de químico e agroquímico do piloto, para mapear anuência específica.
- ☐ Formalizar os workflows n8n existentes (`Classificador_fiscal`, `Agente Custos CTI`) dentro da arquitetura de 5 camadas, como base de código a evoluir no Claude Code.

O desdobramento desse to-do em sprints está em [../roadmap/sprints.md](../roadmap/sprints.md).

### Fases de escala

| Fase | Foco | Bloco de trabalho |
|---|---|---|
| 1 | Cosmético (ANVISA) | Curadoria + pipeline genérico de ingestão + validação de ponta a ponta |
| 2 | Extensão para Químico | Reaplicar o mesmo pipeline sem redesenho; resolver pendência de anuência |
| 3 | Extensão para Agroquímico | Registro tripartite — teste final de escala multiagência |
| Transversal | Motor de custeio | Implementar flag `compensavel` e tabela de transição IBS/CBS 2026→2033 |
| Transversal | Guardrails e evals | H1–H4 aplicados nos três segmentos, comparando resultados como evidência de generalização |
