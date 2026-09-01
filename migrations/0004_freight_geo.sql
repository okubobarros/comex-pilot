-- ============================================================================
-- MCAT / ComexPilot — Coordenadas dos portos (Radar de Mercado)
--
-- Complementa migrations/0003_freight.sql para quem já a aplicou. O Radar
-- posiciona os portos por latitude/longitude REAIS; sem estas colunas a view
-- não tem como alimentar o mapa.
--
-- Os valores chegam pelo seed (seeds/freight/0004_freight_a_stage.sql).
-- Idempotente. Alvo: PostgreSQL 14+ (Supabase).
-- ============================================================================

set search_path to mcat, public;

alter table mcat.ports add column if not exists lat numeric(8,5);
alter table mcat.ports add column if not exists lon numeric(8,5);

comment on column mcat.ports.lat is 'Latitude do porto, em graus decimais (WGS84).';
comment on column mcat.ports.lon is 'Longitude do porto, em graus decimais (WGS84).';

-- A view precisa ser recriada para expor as colunas novas ao Radar.
create or replace view v_freight_quotes as
select
  er.id                                        as quote_id,
  fr.id                                        as route_id,
  rs.source_file,
  fr.trade_lane,
  c.code                                       as carrier,
  pol.unlocode                                 as pol,
  pol.name                                     as pol_name,
  pol.country                                  as pol_country,
  pol.lat                                      as pol_lat,
  pol.lon                                      as pol_lon,
  pod.unlocode                                 as pod,
  pod.name                                     as pod_name,
  pod.country                                  as pod_country,
  pod.lat                                      as pod_lat,
  pod.lon                                      as pod_lon,
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

grant select on mcat.v_freight_quotes to authenticated;
