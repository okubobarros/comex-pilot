-- ============================================================================
-- MCAT / ComexPilot — Taxas locais de destino + custo total de frete
--
-- Fonte: TAXASLOCAISPORARMADOR_UNITIZADO_MOEDA.xlsx (639 linhas, 12 portos
-- brasileiros, 13 entidades, 23 códigos de taxa).
--
-- O QUE ESTA MIGRATION RESOLVE
-- ----------------------------
-- O frete internacional sozinho não é o custo do frete. Entre o navio atracar
-- e o contêiner sair do porto existem THC, ISPS, DPP, drop off, BL fee e as
-- taxas do agente de carga — em duas moedas e com duas bases de cobrança
-- diferentes. Somar tudo errado é a diferença entre um custeio que fecha e um
-- que descobre o rombo na fatura.
--
-- TRÊS DECISÕES QUE MERECEM EXPLICAÇÃO
-- ------------------------------------
-- 1. NÃO existe aqui uma tabela `rates` de frete internacional. O módulo já
--    tem `freight_routes` + `equipment_rates` (migration 0003) com as 2.966
--    cotações carregadas e a view `v_freight_quotes`. Criar uma segunda tabela
--    de frete deixaria duas fontes divergindo na primeira atualização. O custo
--    total é calculado SOBRE o que já está lá.
--
-- 2. A planilha identifica o porto por sigla local de 3 letras (SSZ, PNG, IOA)
--    e `ports` usa UN/LOCODE de 5 (BRSSZ). Para os 12 portos do arquivo a
--    regra é exata: LOCODE = 'BR' || sigla — verificado um a um. Guardamos o
--    LOCODE como chave e a sigla como origem, senão o join com o frete
--    internacional simplesmente não casa e o custo local volta zerado, sem
--    erro nenhum aparecer.
--
-- 3. A unidade de cobrança de uma taxa NÃO é derivada do código dela. Ver
--    `charge_issues` abaixo: a ONE registra THC por BL e BL FEE por contêiner,
--    o inverso de todos os outros 12 armadores. Pode ser troca de coluna na
--    origem ou prática real. Não corrigimos por conta própria — sinalizamos.
--
-- Alvo: PostgreSQL 14+ (Supabase). Idempotente.
-- ============================================================================

create schema if not exists mcat;
set search_path to mcat, public, extensions;

create extension if not exists pgcrypto;

-- ============================================================================
-- Tipos
-- ============================================================================
-- `create type` não aceita `if not exists`; o bloco torna a migration
-- re-executável, que é o que o SQL Editor do Supabase exige na prática.
do $$
begin
  if not exists (select 1 from pg_type t
                  join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'charge_unit' and n.nspname = 'mcat') then
    create type mcat.charge_unit as enum ('BL', 'CNTR');
  end if;
  if not exists (select 1 from pg_type t
                  join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'currency_code' and n.nspname = 'mcat') then
    create type mcat.currency_code as enum ('BRL', 'USD', 'EUR');
  end if;
  if not exists (select 1 from pg_type t
                  join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'charge_entity' and n.nspname = 'mcat') then
    create type mcat.charge_entity as enum ('CARRIER', 'FREIGHT_FORWARDER');
  end if;
end $$;

-- ============================================================================
-- Taxas locais de destino
-- ============================================================================
create table if not exists local_charges (
  id               uuid primary key default gen_random_uuid(),

  -- Chave real de junção com o frete internacional (ports.unlocode / pod).
  port_unlocode    char(5) not null references ports(unlocode),
  -- Sigla de 3 letras como veio da planilha. Fica para rastreabilidade e para
  -- exibir do jeito que o mercado fala ("THC de Santos", não "de BRSSZ").
  port_code        varchar(10) not null,
  port_name        varchar(100) not null,

  entity_type      mcat.charge_entity not null,
  entity_name      varchar(100) not null,

  fee_code         varchar(50) not null,
  fee_description  varchar(255),

  currency         mcat.currency_code not null default 'BRL',
  amount           numeric(12,2) not null check (amount > 0),

  -- 'BL'   = uma vez por conhecimento de embarque
  -- 'CNTR' = multiplicada pela quantidade de contêineres
  calculation_unit mcat.charge_unit not null,

  is_active        boolean not null default true,
  source_file      text,
  source_row       integer,               -- linha da planilha, para conferência
  updated_at       timestamptz not null default now(),

  constraint unique_local_charge
    unique (port_code, entity_name, fee_code, calculation_unit, currency)
);

create index if not exists idx_local_charges_porto
  on local_charges (port_unlocode, entity_name) where is_active;
create index if not exists idx_local_charges_entidade
  on local_charges (entity_name);

comment on column local_charges.port_unlocode is
  'UN/LOCODE do porto — é por aqui que a taxa local encontra o frete internacional (v_freight_quotes.pod).';
comment on column local_charges.calculation_unit is
  'BL = cobrada uma vez por embarque; CNTR = multiplicada pela quantidade de contêineres.';

-- ============================================================================
-- Ressalvas da fonte
-- ============================================================================
-- Mesmo propósito de `rate_issues`: o dado entra como está e a divergência
-- entra ao lado, visível. Uma taxa "consertada" em silêncio vira um número que
-- ninguém sabe explicar quando a fatura chega diferente.
create table if not exists charge_issues (
  id           uuid primary key default gen_random_uuid(),
  charge_id    uuid references local_charges(id) on delete cascade,
  port_code    varchar(10),
  entity_name  varchar(100),
  fee_code     varchar(50),
  severity     text not null check (severity in ('erro','aviso','info')),
  kind         text not null,
  detail       text not null,
  source_row   integer,
  created_at   timestamptz not null default now()
);
create index if not exists idx_charge_issues_entidade
  on charge_issues (entity_name, severity);

-- ============================================================================
-- View 1 — taxas locais achatadas por porto + entidade
-- ============================================================================
-- Responde "o que a MSC cobra em Santos" sem que a aplicação precise saber
-- somar por unidade e por moeda. Cada linha já vem separada nas quatro
-- combinações possíveis (BL/CNTR x BRL/USD), que é o grão em que o cálculo
-- de um embarque é uma multiplicação simples.
drop view if exists v_local_charges_summary;
create view v_local_charges_summary as
select
  lc.port_unlocode,
  lc.port_code,
  lc.port_name,
  lc.entity_type,
  lc.entity_name,
  count(*)                                                          as qtd_taxas,
  sum(lc.amount) filter (where lc.calculation_unit = 'BL'   and lc.currency = 'BRL') as por_bl_brl,
  sum(lc.amount) filter (where lc.calculation_unit = 'BL'   and lc.currency = 'USD') as por_bl_usd,
  sum(lc.amount) filter (where lc.calculation_unit = 'CNTR' and lc.currency = 'BRL') as por_cntr_brl,
  sum(lc.amount) filter (where lc.calculation_unit = 'CNTR' and lc.currency = 'USD') as por_cntr_usd,
  -- Sinaliza que alguma taxa desta combinação tem ressalva registrada.
  exists (
    select 1 from charge_issues ci
     where ci.port_code = lc.port_code
       and ci.entity_name = lc.entity_name
       and ci.severity in ('erro','aviso')
  )                                                                 as tem_ressalva
from local_charges lc
where lc.is_active
group by lc.port_unlocode, lc.port_code, lc.port_name, lc.entity_type, lc.entity_name;

comment on view v_local_charges_summary is
  'Taxas locais por porto e entidade, já separadas nas 4 combinações unidade x moeda.';

-- ============================================================================
-- Função — custo total do frete de importação
-- ============================================================================
-- Recebe um embarque concreto e devolve UMA linha com o custo aberto.
--
-- Sobre o câmbio: a taxa entra como parâmetro, não é lida de lugar nenhum.
-- A conversão correta depende de qual pergunta se está fazendo — o valor
-- aduaneiro usa a taxa da data do registro da DI, o desembolso usa a do
-- pagamento. Fixar uma aqui dentro seria escolher pelo usuário e errar
-- silenciosamente na metade dos casos.
--
-- Sobre o agente de carga: as taxas dele (DESCO, TRS, COURIER, HANDL) são
-- cobradas junto com as do armador e por isso entram por padrão. Ele nunca tem
-- THC nem BL FEE na planilha — quem cobra essas duas é o armador —, então as
-- duas fontes se somam sem duplicar nada.
create or replace function total_freight_cost(
  p_pol                text,
  p_pod                text,
  p_carrier            text,
  p_equipment          text,
  p_containers         integer,
  p_usd_brl            numeric,
  p_include_forwarder  boolean default true,
  p_forwarder_name     text    default 'AGENTE DE CARGA'
)
returns table (
  carrier              text,
  pol                  char(5),
  pod                  char(5),
  pod_name             text,
  equipment_type       text,
  containers           integer,
  usd_brl              numeric,
  ocean_freight_usd    numeric,   -- já multiplicado pela quantidade
  surcharges_usd       numeric,
  local_bl_brl         numeric,
  local_bl_usd         numeric,
  local_cntr_brl       numeric,   -- já multiplicado pela quantidade
  local_cntr_usd       numeric,
  local_total_usd      numeric,
  total_usd            numeric,
  total_brl            numeric,
  validity_end         date,
  status_validade      text,
  tem_ressalva_taxas   boolean,
  ressalvas            text[]
)
language sql
stable
as $$
  with frete as (
    -- Uma cotação por (rota, equipamento). Quando há mais de uma vigente para
    -- o mesmo par, fica a mais barata entre as de melhor status — o mesmo
    -- critério de ordenação que a tela usa.
    select q.*
      from v_freight_quotes q
     where q.pol = upper(p_pol)
       and q.pod = upper(p_pod)
       and q.carrier = upper(p_carrier)
       and q.equipment_type = upper(p_equipment)
     order by
       case q.status_validade
         when 'vigente'      then 0
         when 'expirando'    then 1
         when 'sem_validade' then 2
         else 3
       end,
       q.base_rate
     limit 1
  ),
  entidades as (
    select upper(p_carrier) as nome
    union
    select upper(p_forwarder_name) where p_include_forwarder
  ),
  taxas as (
    select
      coalesce(sum(lc.amount) filter (where lc.calculation_unit = 'BL'   and lc.currency = 'BRL'), 0) as bl_brl,
      coalesce(sum(lc.amount) filter (where lc.calculation_unit = 'BL'   and lc.currency = 'USD'), 0) as bl_usd,
      coalesce(sum(lc.amount) filter (where lc.calculation_unit = 'CNTR' and lc.currency = 'BRL'), 0) as cntr_brl,
      coalesce(sum(lc.amount) filter (where lc.calculation_unit = 'CNTR' and lc.currency = 'USD'), 0) as cntr_usd
      from local_charges lc
     where lc.is_active
       and lc.port_unlocode = upper(p_pod)
       and upper(lc.entity_name) in (select nome from entidades)
  ),
  avisos as (
    select coalesce(array_agg(distinct ci.detail), '{}'::text[]) as lista
      from charge_issues ci
     where ci.severity in ('erro','aviso')
       and upper(ci.entity_name) in (select nome from entidades)
       and (ci.port_code is null or 'BR' || ci.port_code = upper(p_pod))
  )
  select
    f.carrier::text,
    f.pol,
    f.pod,
    f.pod_name::text,
    f.equipment_type::text,
    p_containers,
    p_usd_brl,
    round(coalesce(f.base_rate, 0) * p_containers, 2),
    round(coalesce(f.surcharges_fixas_usd, 0) * p_containers, 2),
    round(t.bl_brl, 2),
    round(t.bl_usd, 2),
    round(t.cntr_brl * p_containers, 2),
    round(t.cntr_usd * p_containers, 2),
    -- Custo local inteiro trazido para USD.
    round(t.bl_usd + t.cntr_usd * p_containers
          + (t.bl_brl + t.cntr_brl * p_containers) / nullif(p_usd_brl, 0), 2),
    round(
      coalesce(f.base_rate, 0) * p_containers
      + coalesce(f.surcharges_fixas_usd, 0) * p_containers
      + t.bl_usd + t.cntr_usd * p_containers
      + (t.bl_brl + t.cntr_brl * p_containers) / nullif(p_usd_brl, 0), 2),
    round((
      coalesce(f.base_rate, 0) * p_containers
      + coalesce(f.surcharges_fixas_usd, 0) * p_containers
      + t.bl_usd + t.cntr_usd * p_containers
    ) * p_usd_brl + t.bl_brl + t.cntr_brl * p_containers, 2),
    f.validity_end,
    f.status_validade::text,
    cardinality(a.lista) > 0,
    a.lista
  from frete f
  cross join taxas t
  cross join avisos a;
$$;

comment on function total_freight_cost is
  'Custo total do frete de importação: frete internacional (por contêiner) + taxas locais do destino, '
  'somando armador e agente de carga, nas duas moedas. A taxa USD/BRL entra por parâmetro porque a '
  'conversão correta depende da data de referência da pergunta.';
