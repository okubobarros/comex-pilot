-- ============================================================================
-- MCAT / ComexPilot — Migration base (Sprint 0)
-- Cria o schema das 5 camadas descritas em docs/architecture/data-model.md
-- Alvo: PostgreSQL 14+ (Supabase). Idempotente (IF NOT EXISTS / CREATE OR REPLACE).
--
-- Tudo vive no schema dedicado `mcat`, isolado do `public` (que pode conter
-- tabelas de outro app). Para a API do Supabase enxergar: Settings > API >
-- Exposed schemas > adicionar `mcat`. Ver docs/ops/sprint-0.md.
-- ============================================================================

create schema if not exists mcat;
set search_path to mcat, public, extensions;

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;     -- pgvector (RAG). Supabase já inclui.

-- ============================================================================
-- CAMADA 1 — Tabelas de referência (dados das planilhas)
-- ============================================================================

-- Base NCM hierárquica. Fonte: Tabela_NCM_Vigente_*.xlsx
create table if not exists ncm (
  codigo          text primary key,                 -- "3304.99.90"
  codigo_norm     text generated always as (regexp_replace(codigo, '[^0-9]', '', 'g')) stored,
  descricao       text not null,
  nivel           smallint not null,                -- 2=cap, 4=posição, 6=subpos, 8=item
  parent_codigo   text references ncm(codigo),
  vigencia_inicio date not null default current_date,
  vigencia_fim    date not null default date '9999-12-31',
  ato_legal       text
);
create index if not exists idx_ncm_codigo_norm on ncm(codigo_norm);
create index if not exists idx_ncm_descricao_fts on ncm using gin (to_tsvector('portuguese', descricao));

-- Tributos federais por NCM (versionado). Fonte: aba `tax` do tax_calc.xlsx (a `Ctax` está vazia)
create table if not exists ncm_tributo (
  ncm_codigo      text not null references ncm(codigo),
  vigencia_inicio date not null default current_date,
  vigencia_fim    date not null default date '9999-12-31',
  ii_pct          numeric(6,3),
  ipi_pct         numeric(6,3),
  pis_pct         numeric(6,3),
  cofins_pct      numeric(6,3),
  cide            boolean not null default false,
  antidumping     boolean not null default false,
  medidas_comp    boolean not null default false,
  tratamentos_adm text,
  primary key (ncm_codigo, vigencia_inicio)
);

-- ICMS + AFRMM por UF. Fonte: aba icms (AFRMM tratado por modal em ibs_cbs/costing, não aqui)
create table if not exists icms_uf (
  uf                 char(2) primary key,
  estado             text not null,
  icms_pct           numeric(5,2) not null,
  taxa_utilizacao_mm numeric(5,2)
);

-- Taxa Siscomex por nº de adições. Fonte: aba siscomex
create table if not exists siscomex_taxa (
  qtde_adicoes     int primary key,
  valor_por_adicao numeric(10,2),
  valor_total      numeric(10,2)
);

-- Câmbio PTAX. Bootstrap do xlsx; produção via API BCB Olinda.
create table if not exists cambio_ptax (
  data    date primary key,
  usd_brl numeric(10,4),
  eur_brl numeric(10,4)
);

-- AFRMM: alíquotas federais por modal (Receita Federal). Substitui a coluna do xlsx.
create table if not exists afrmm_aliquota (
  modal           text primary key,   -- longo_curso | cabotagem | fluvial_lacustre_granel_nne
  aliquota_pct    numeric(5,2) not null,
  base_legal      text
);

-- ============================================================================
-- CAMADA 2 — Reforma Tributária (núcleo versionado do to-be)
-- ============================================================================

create table if not exists ibs_cbs_regra (
  vigencia_inicio  date primary key,
  vigencia_fim     date not null default date '9999-12-31',
  cbs_pct          numeric(6,3),
  ibs_pct          numeric(6,3),
  cbs_compensavel  boolean not null,
  ibs_compensavel  boolean not null,
  pis_cofins_ativo boolean not null,
  ipi_zerado       boolean not null default false,
  base_legal       text
);

create table if not exists aliquota_ibs_cbs (
  ncm_codigo      text not null references ncm(codigo),
  uf              char(2) not null references icms_uf(uf),
  vigencia_inicio date not null,
  vigencia_fim    date not null default date '9999-12-31',
  valor_pct       numeric(6,3) not null,
  compensavel     boolean not null,
  primary key (ncm_codigo, uf, vigencia_inicio)
);

-- ============================================================================
-- CAMADA 3 — Anuência / órgãos / normas (grafo como relações)
-- ============================================================================

create table if not exists orgao_anuente (
  id             serial primary key,
  nome           text unique not null,
  tipo_exigencia text
);

create table if not exists ncm_anuencia (
  ncm_codigo text not null references ncm(codigo),
  orgao_id   int not null references orgao_anuente(id),
  exigencia  text,
  base_legal text,
  primary key (ncm_codigo, orgao_id)
);

create table if not exists norma (
  id              serial primary key,
  tipo            text,
  orgao_emissor   text,
  identificacao   text unique,           -- "RDC 907/2024", "LC 214/2025"
  ementa          text,
  vigencia_inicio date,
  vigencia_fim    date default date '9999-12-31'
);

create table if not exists norma_relacao (
  origem_id  int not null references norma(id),
  destino_id int not null references norma(id),
  tipo       text not null,              -- revoga | altera | regulamenta
  primary key (origem_id, destino_id, tipo)
);

-- ============================================================================
-- CAMADA 4 — Operacional (processo real do usuário)
-- ============================================================================

create table if not exists processo (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid,
  status     text,                       -- rascunho | em_auditoria | concluido
  canal      text,                       -- verde | amarelo | vermelho
  criado_em  timestamptz not null default now()
);

create table if not exists documento (
  id                uuid primary key default gen_random_uuid(),
  processo_id       uuid references processo(id),
  tipo              text,                -- invoice | packing_list | bl | duimp
  conteudo_extraido jsonb,
  hash              text
);

create table if not exists divergencia (
  id          uuid primary key default gen_random_uuid(),
  processo_id uuid references processo(id),
  tipo        text,
  severidade  text                       -- red | yellow | green
);

create table if not exists decisao (
  id              uuid primary key default gen_random_uuid(),
  processo_id     uuid references processo(id),
  recomendacao    text,
  justificativa   text,
  citacoes        jsonb,                 -- [{norma_id, trecho, url}]
  nivel_confianca numeric(4,3),
  origem          text,                  -- 'ia' | 'humano'
  criado_em       timestamptz not null default now()
);

-- Trilha append-only (nunca UPDATE/DELETE).
create table if not exists event_log (
  id          bigserial primary key,
  processo_id uuid,
  ator        text,
  acao        text,
  payload     jsonb,
  criado_em   timestamptz not null default now()
);

-- ============================================================================
-- CAMADA 5 — RAG (pgvector)
-- ============================================================================

create table if not exists norma_chunk (
  id        bigserial primary key,
  norma_id  int references norma(id),
  trecho    text,
  embedding vector(768)
);
create index if not exists idx_norma_chunk_embedding
  on norma_chunk using hnsw (embedding vector_cosine_ops);
