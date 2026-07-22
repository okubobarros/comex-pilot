# Modelo de dados e escolha de banco

_Deriva das entidades do PRD (§4.4) e das fontes reais (`tax_calc.xlsx`, Tabela NCM vigente)._

## Decisão: PostgreSQL (Supabase) + pgvector

| Necessidade | Escolha | Por quê |
|---|---|---|
| Tabelas de referência (NCM, tributos, ICMS, siscomex, câmbio, IBS/CBS) | **Postgres** | Relacional, versionável por linha, já em uso |
| Dados operacionais (processo, documento, divergência, decisão) | **Postgres** | Transacional + RLS por cliente |
| Trilha de auditoria append-only | **Postgres** (tabela `event_log`, insert-only) | Requisito EU AI Act / evals H2–H3 |
| RAG / busca semântica em normas | **pgvector** (extensão) | Evita um vector DB separado nesta fase |
| Grafo normativo versionado | **Relações em Postgres** (`norma`, `norma_relacao`) | Adiar Neo4j até o raciocínio multi-hop justificar |

**Por que não um DB de grafo agora:** o "Graph-RAG" do PRD é uma meta de capacidade, não uma
obrigação de infraestrutura. Modelar norma↔norma e NCM↔anuência como tabelas de relação versionadas
entrega 80% do valor (citação, vigência, dependência) sem operar um segundo banco. Reavaliar na Fase 2/3.

**Infra já existente:** projeto Supabase `cpzjxgcekxyunktmcmay` — contém as tabelas de **outro app**
(`dossies`, `documentos`, `icms_uf`, …), que **não devem ser tocadas**. Por isso todo o schema novo
vive no schema isolado **`mcat`** (não no `public`). Ver [../ops/sprint-0.md](../ops/sprint-0.md).
O fluxo n8n legado não será reaproveitado nem rotacionado (decisão do CEO;
[../ops/n8n-flows-audit.md](../ops/n8n-flows-audit.md)).

## Camada 1 — Tabelas de referência (dados vindos das planilhas)

```sql
-- Base NCM hierárquica (15.161 códigos). Fonte: Tabela_NCM_Vigente_*.xlsx
create table ncm (
  codigo          text primary key,          -- "3304.99.90" (formato oficial com pontos)
  codigo_norm     text generated always as (regexp_replace(codigo,'\D','','g')) stored, -- "33049990"
  descricao       text not null,
  nivel           smallint not null,         -- 2=capítulo, 4=posição, 6=subposição, 8=item
  parent_codigo   text references ncm(codigo),
  vigencia_inicio date not null,
  vigencia_fim    date not null default '9999-12-31',
  ato_legal       text                        -- "Res Camex 272/2021"
);
-- Vigência é filtrada na consulta (vigencia_fim >= current_date); não use coluna
-- gerada com current_date — não é IMMUTABLE e o Postgres rejeita (visto na Sprint 0).
create index on ncm(codigo_norm);
create index on ncm using gin (to_tsvector('portuguese', descricao));

-- Tributos federais por NCM. Fonte: aba `Ctax`/`tax` do tax_calc.xlsx (10.520+ linhas)
create table ncm_tributo (
  ncm_codigo      text references ncm(codigo),
  vigencia_inicio date not null default current_date,
  vigencia_fim    date not null default '9999-12-31',
  ii_pct          numeric(6,3),
  ipi_pct         numeric(6,3),
  pis_pct         numeric(6,3),
  cofins_pct      numeric(6,3),
  cide            boolean default false,
  antidumping     boolean default false,
  medidas_comp    boolean default false,
  tratamentos_adm text,                        -- texto de anuências/LI (parsear depois)
  primary key (ncm_codigo, vigencia_inicio)
);

-- ICMS + AFRMM por UF. Fonte: aba `icms`
create table icms_uf (
  uf                 char(2) primary key,
  estado             text not null,
  icms_pct           numeric(5,2) not null,    -- normalizar "20,50" -> 20.50 no ETL
  afrmm_pct          numeric(5,2) not null default 0,
  taxa_utilizacao_mm numeric(5,2)
);

-- Taxa Siscomex por nº de adições. Fonte: aba `siscomex`
create table siscomex_taxa (
  qtde_adicoes       int primary key,
  valor_por_adicao   numeric(10,2),
  valor_total        numeric(10,2)
);

-- Câmbio diário (PTAX). Fonte: aba `exchange_rate`
create table cambio_ptax (
  data     date primary key,
  usd_brl  numeric(10,4),
  eur_brl  numeric(10,4)
);
```

## Camada 2 — Reforma Tributária (o núcleo versionado do to-be)

```sql
-- Regra de transição por ano (2026 teste -> 2033 definitivo). Fonte: PRD §4.3
create table ibs_cbs_regra (
  vigencia_inicio date not null,
  vigencia_fim    date not null default '9999-12-31',
  cbs_pct         numeric(6,3),               -- 2026: 0.900
  ibs_pct         numeric(6,3),               -- 2026: 0.100
  cbs_compensavel boolean not null,           -- 2026: true (compensa com PIS/COFINS)
  ibs_compensavel boolean not null,
  pis_cofins_ativo boolean not null,          -- 2027: false
  ipi_zerado      boolean not null default false,
  base_legal      text,                       -- "LC 214/2025, art. 348, I"
  primary key (vigencia_inicio)
);

-- Alíquota IBS/CBS específica por NCM+estado quando divergir da regra geral. Fonte: PRD entidade AliquotaIBSCBS
create table aliquota_ibs_cbs (
  ncm_codigo      text references ncm(codigo),
  uf              char(2) references icms_uf(uf),
  vigencia_inicio date not null,
  vigencia_fim    date not null default '9999-12-31',
  valor_pct       numeric(6,3) not null,
  compensavel     boolean not null,
  primary key (ncm_codigo, uf, vigencia_inicio)
);
```

## Camada 3 — Anuência / órgãos (base multiagente)

```sql
create table orgao_anuente (
  id            serial primary key,
  nome          text unique not null,          -- ANVISA, MAPA, IBAMA, INMETRO, ANATEL, DECEX, SUFRAMA
  tipo_exigencia text
);

create table ncm_anuencia (
  ncm_codigo  text references ncm(codigo),
  orgao_id    int references orgao_anuente(id),
  exigencia   text,                             -- "LI antes do embarque", "AFE", "registro"
  base_legal  text,
  primary key (ncm_codigo, orgao_id)
);

-- Normas versionadas (grafo modelado como relações). Fonte: PRD entidade Norma
create table norma (
  id              serial primary key,
  tipo            text,                          -- RDC, IN RFB, LC, Decreto
  orgao_emissor   text,
  identificacao   text,                          -- "RDC 752/2022"
  ementa          text,
  vigencia_inicio date,
  vigencia_fim    date default '9999-12-31'
);
create table norma_relacao (                     -- aresta do grafo normativo
  origem_id  int references norma(id),
  destino_id int references norma(id),
  tipo       text,                               -- "revoga", "altera", "regulamenta"
  primary key (origem_id, destino_id, tipo)
);
```

## Camada 4 — Operacional (o processo real do usuário)

```sql
create table processo (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid,
  status      text,                              -- rascunho | em_auditoria | concluido
  canal       text,                              -- verde | amarelo | vermelho
  criado_em   timestamptz default now()
);
create table documento (
  id                uuid primary key default gen_random_uuid(),
  processo_id       uuid references processo(id),
  tipo              text,                         -- invoice | packing_list | bl | duimp
  conteudo_extraido jsonb,
  hash              text                          -- dedup + integridade
);
create table divergencia (
  id          uuid primary key default gen_random_uuid(),
  processo_id uuid references processo(id),
  tipo        text,
  severidade  text                                -- red | yellow | green (espelha AlertSeverity do app)
);
create table decisao (
  id             uuid primary key default gen_random_uuid(),
  processo_id    uuid references processo(id),
  recomendacao   text,
  justificativa  text,
  citacoes       jsonb,                            -- [{norma_id, trecho, url}] -> citação clicável
  nivel_confianca numeric(4,3),                    -- < limiar => "revisão manual"
  origem         text,                             -- 'ia' | 'humano' (marca IA vs validado)
  criado_em      timestamptz default now()
);

-- Trilha append-only (nunca UPDATE/DELETE). Base do "desfazer" e das evals.
create table event_log (
  id          bigserial primary key,
  processo_id uuid,
  ator        text,                               -- agente ou user_id
  acao        text,
  payload     jsonb,
  criado_em   timestamptz default now()
);
```

## Camada 5 — RAG (pgvector)

```sql
create extension if not exists vector;
create table norma_chunk (
  id         bigserial primary key,
  norma_id   int references norma(id),
  trecho     text,
  embedding  vector(768)                          -- dimensão conforme modelo de embedding escolhido
);
create index on norma_chunk using hnsw (embedding vector_cosine_ops);
```

## Como isso substitui o mock do app

O tipo `NcmRule` de [`src/types.ts`](../../src/types.ts) e `DEFAULT_NCM_RULES` de
[`src/data/mockScenarios.ts`](../../src/data/mockScenarios.ts) passam a ser **projeção de um
`JOIN`** entre `ncm`, `ncm_tributo`, `ncm_anuencia` e `aliquota_ibs_cbs` filtrado por
`data_fato_gerador`. Nenhuma mudança na UI: o backend entrega o mesmo shape, agora com dado real.
Mapeamento campo-a-campo em [../data/ncm-tax-base.md](../data/ncm-tax-base.md).
