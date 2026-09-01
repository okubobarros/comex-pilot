-- ============================================================================
-- MCAT / ComexPilot — Módulo de Frete Marítimo (rate sheets desagrupadas)
--
-- Problema: a rate sheet do armador é uma planilha de AGRUPAMENTOS. Uma linha
-- carrega N portos de origem, M portos de destino, 3 equipamentos, tarifas
-- condicionais a peso e overrides por destino. Buscar "Xiamen -> Itapoá, 40'HQ,
-- 15 toneladas" em cima dessa estrutura é impossível.
--
-- Solução: normalizar até o grão em que a pergunta comercial é respondível —
-- (rota) x (equipamento). Ver scripts/etl/parse_rate_sheet.py e
-- docs/freight-rate-engine.md.
--
-- Alvo: PostgreSQL 14+ (Supabase). Idempotente.
-- ============================================================================

create schema if not exists mcat;
set search_path to mcat, public, extensions;

create extension if not exists pgcrypto;

-- ============================================================================
-- Dimensões
-- ============================================================================

-- Armadores. O mesmo transportador aparece como "MSK" e "Maersk" entre abas:
-- `code` é a forma canônica resolvida no ETL.
create table if not exists carriers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Portos padronizados por UN/LOCODE. É o LOCODE — não o nome — que resolve
-- "Tianjin" e "Xingang" como o MESMO porto (CNTXG) e "Ninbgo"/"Ningbo" como o
-- mesmo destino. Sem isso, a busca por par origem/destino não fecha.
create table if not exists ports (
  id        uuid primary key default gen_random_uuid(),
  unlocode  char(5) not null unique,
  name      text not null,
  country   char(2) not null
);
create index if not exists idx_ports_country on ports (country);

-- ============================================================================
-- Rate sheet (o arquivo recebido)
-- ============================================================================
-- Guardar a origem é requisito de auditoria: toda cotação exibida ao cliente
-- precisa apontar para o arquivo, a aba e a LINHA de onde veio.
create table if not exists rate_sheets (
  id           uuid primary key default gen_random_uuid(),
  source_file  text not null,
  issued_on    date,
  currency     char(3) not null default 'USD',
  -- A planilha do armador não traz ANO nas validades ("9.01~9.07"). O ano é
  -- inferido no ETL; registrar a premissa evita interpretar 2026 como 2025.
  assumed_year smallint,
  imported_at  timestamptz not null default now(),
  unique (source_file, issued_on)
);

-- ============================================================================
-- Rota desagrupada — o coração do modelo
-- ============================================================================
-- 1 linha da planilha vira N x M linhas aqui (produto cartesiano POL x POD).
create table if not exists freight_routes (
  id              uuid primary key default gen_random_uuid(),
  rate_sheet_id   uuid not null references rate_sheets(id) on delete cascade,
  carrier_id      uuid not null references carriers(id),
  pol_id          uuid not null references ports(id),
  pod_id          uuid not null references ports(id),
  trade_lane      text,
  service_type    text not null default 'Direct'
                  check (service_type in ('Direct', 'Transhipment', 'Outro')),
  service_name    text,                 -- "Ipanema service", "via Panama"
  validity_start  date,
  validity_end    date,
  -- O texto original da validade fica preservado: ele carrega navio, viagem e
  -- observações que nenhuma coluna de data comporta.
  validity_raw    text,
  vessel_ref      text,
  space_status    text,
  source_sheet    text,
  source_row      integer,              -- rastreabilidade até a linha da planilha
  carrier_scope   text,                 -- "NAC", "PNEU": contrato de conta nomeada
  created_at      timestamptz not null default now(),
  check (validity_end is null or validity_start is null or validity_end >= validity_start)
);
create index if not exists idx_routes_par     on freight_routes (pol_id, pod_id);
create index if not exists idx_routes_vig     on freight_routes (validity_start, validity_end);
create index if not exists idx_routes_carrier on freight_routes (carrier_id);
create index if not exists idx_routes_sheet   on freight_routes (rate_sheet_id);

-- ============================================================================
-- Tarifa por equipamento
-- ============================================================================
create table if not exists equipment_rates (
  id              uuid primary key default gen_random_uuid(),
  route_id        uuid not null references freight_routes(id) on delete cascade,
  equipment_type  text not null
                  check (equipment_type in ('20GP','40GP','40HQ','40NOR','40RF','LCL')),
  -- A coluna "40'GP/40'HQ" da planilha é UMA tarifa para DOIS equipamentos.
  -- Guardar os equivalentes evita duplicar a linha e ainda permite filtrar.
  also_valid_for  text,
  base_rate       numeric(10,2) not null,
  currency        char(3) not null default 'USD',
  unit            text not null default 'CONTAINER'
                  check (unit in ('CONTAINER','CBM')),

  -- Tarifa condicional a peso: "9700, (9400 <= 16ton cargo weight)".
  -- `weight_basis` não é detalhe: VGM inclui a tara do contêiner (~3,7t num
  -- 40'), CARGO não. Aplicar um limite de VGM sobre o peso da mercadoria
  -- concede um desconto que o armador vai glosar na fatura.
  adjusted_rate     numeric(10,2),
  weight_operator   text check (weight_operator in ('<','<=','>','>=')),
  weight_limit_ton  numeric(6,2),
  weight_basis      text check (weight_basis in ('VGM','CARGO','NAO_ESPECIFICADO')),

  -- Tarifa restrita a mercadoria: "8500 (Tyre)", "5500 (Solar)". É o gancho
  -- natural para a NCM — pneu é 4011.x, painel solar 8541.x.
  cargo_type      text,
  -- 'base' | 'override_pod': a tarifa veio da célula geral ou de um valor
  -- específico daquele destino ("8910, (RIO, 8610)").
  rate_source     text not null default 'base',
  raw_cell        text not null,        -- célula original, para conferência
  created_at      timestamptz not null default now(),
  unique (route_id, equipment_type, cargo_type)
);
create index if not exists idx_eqrates_route on equipment_rates (route_id);
create index if not exists idx_eqrates_equip on equipment_rates (equipment_type);
create index if not exists idx_eqrates_cargo on equipment_rates (cargo_type) where cargo_type is not null;

-- ============================================================================
-- Taxas e adicionais
-- ============================================================================
-- Vêm de 3 lugares distintos da planilha: "Subject to", "Remark" e — quando o
-- preenchimento escorregou — da própria coluna de equipamento. `source_column`
-- registra de onde saiu.
create table if not exists rate_surcharges (
  id              uuid primary key default gen_random_uuid(),
  route_id        uuid not null references freight_routes(id) on delete cascade,
  fee_code        text not null,        -- ISPS, CSS, SPG, LWS, PCT, OWS, OTHER
  fee_label       text,
  amount          numeric(10,2) not null,
  currency        char(3) not null default 'USD',
  charge_basis    text not null default 'PER_CONTAINER'
                  check (charge_basis in ('PER_CONTAINER','PER_BL','PER_CBM','PER_TON')),
  equipment_type  text,                 -- null = vale para todos
  -- OWS (overweight) é escalonado: USD200 acima de 14t, USD500 acima de 20t.
  min_weight_ton  numeric(6,2),
  condition_raw   text,
  source_column   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_surch_route on rate_surcharges (route_id);

-- ============================================================================
-- Free time (demurrage / detention)
-- ============================================================================
-- ATENÇÃO À PREMISSA: a planilha escreve "21 /18 days" sem dizer o que é cada
-- número. Adotamos origem/destino conforme o modelo pedido, mas boa parte do
-- mercado usa esse par como demurrage/detention no DESTINO. Confirmar com o
-- armador antes de usar como compromisso contratual. Ver docs/freight-rate-engine.md.
create table if not exists free_time_rules (
  id             uuid primary key default gen_random_uuid(),
  route_id       uuid not null references freight_routes(id) on delete cascade,
  free_days_pol  smallint,
  free_days_pod  smallint,
  raw            text,
  unique (route_id)
);

-- ============================================================================
-- Trilha de qualidade da carga
-- ============================================================================
-- O diferencial do módulo não é ler a planilha bonita — é dizer no que NÃO se
-- pode confiar. Tarifa com dígito faltando, data que não existe no calendário
-- (11.31), porto fora do dicionário: tudo vira linha aqui em vez de sumir.
create table if not exists rate_issues (
  id             uuid primary key default gen_random_uuid(),
  rate_sheet_id  uuid not null references rate_sheets(id) on delete cascade,
  source_sheet   text,
  source_row     integer,
  severity       text not null check (severity in ('erro','aviso','info')),
  kind           text not null,
  detail         text not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_issues_sheet on rate_issues (rate_sheet_id, severity);

-- ============================================================================
-- View de consulta — o grão que a UI e a API realmente usam
-- ============================================================================
create or replace view v_freight_quotes as
select
  er.id                                        as quote_id,
  fr.id                                        as route_id,
  rs.source_file,
  fr.trade_lane,
  c.code                                       as carrier,
  pol.unlocode                                 as pol,
  pol.name                                     as pol_name,
  pod.unlocode                                 as pod,
  pod.name                                     as pod_name,
  pod.country                                  as pod_country,
  fr.service_type,
  fr.service_name,
  fr.validity_start,
  fr.validity_end,
  fr.validity_raw,
  fr.vessel_ref,
  fr.space_status,
  fr.carrier_scope,
  er.equipment_type,
  er.also_valid_for,
  er.base_rate,
  er.adjusted_rate,
  er.weight_operator,
  er.weight_limit_ton,
  er.weight_basis,
  er.cargo_type,
  er.unit,
  er.currency,
  ft.free_days_pol,
  ft.free_days_pod,
  -- Taxas que independem de peso e de equipamento entram no total mínimo.
  coalesce((
    select sum(s.amount) from rate_surcharges s
     where s.route_id = fr.id
       and s.min_weight_ton is null
       and (s.equipment_type is null or s.equipment_type = er.equipment_type)
  ), 0)                                        as surcharges_fixas_usd,
  case
    when fr.validity_end is null                    then 'sem_validade'
    when fr.validity_end < current_date             then 'expirado'
    when fr.validity_end <= current_date + 3        then 'expirando'
    else 'vigente'
  end                                          as status_validade,
  fr.source_sheet,
  fr.source_row
from equipment_rates er
join freight_routes fr on fr.id = er.route_id
join rate_sheets    rs on rs.id = fr.rate_sheet_id
join carriers       c  on c.id  = fr.carrier_id
join ports          pol on pol.id = fr.pol_id
join ports          pod on pod.id = fr.pod_id
left join free_time_rules ft on ft.route_id = fr.id;

-- ============================================================================
-- RLS + GRANTs (mesma política de 0002_rls.sql)
-- ============================================================================
-- Tarifa de frete é dado COMERCIAL negociado, não referência pública: sem
-- acesso para `anon`. Leitura só para usuário autenticado; escrita só backend.
do $$
declare t text;
begin
  foreach t in array array['carriers','ports','rate_sheets','freight_routes',
                           'equipment_rates','rate_surcharges','free_time_rules','rate_issues']
  loop
    execute format('alter table mcat.%I enable row level security', t);
    execute format('grant select on mcat.%I to authenticated', t);
    execute format('grant all on mcat.%I to service_role', t);
    execute format($p$
      drop policy if exists %1$s_read on mcat.%1$I;
      create policy %1$s_read on mcat.%1$I for select to authenticated using (true);
    $p$, t);
  end loop;
end $$;

grant usage on schema mcat to authenticated, service_role;
grant select on mcat.v_freight_quotes to authenticated;
