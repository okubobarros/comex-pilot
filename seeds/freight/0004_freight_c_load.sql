-- GERADO POR scripts/etl/parse_rate_sheet.py — NÃO EDITAR À MÃO.
-- Fonte: rate sheet 0901.xlsx | importado em 2026-09-01T16:27:18
-- ============================================================================
-- PARTE C — carga definitiva (rode por ÚLTIMO)
-- Tudo em conjuntos: 6 INSERTs cobrem as ~5.600 linhas. Transação única —
-- qualquer falha desfaz a carga inteira.
-- ============================================================================
set search_path to mcat, public;
begin;

do $$
declare
  v_sheet uuid;
  v_rotas int;
  v_tarifas int;
begin
  -- Esta parte apaga o staging no fim, então rodá-la duas vezes encontraria as
  -- tabelas ausentes. Em vez de falhar com "relation does not exist", avisa.
  if to_regclass('mcat._stage_route') is null then
    raise notice 'Staging ausente: a carga já foi executada (ou as partes A/B ainda não rodaram).';
    raise notice 'Confira o resultado na consulta ao final deste arquivo.';
    return;
  end if;

  insert into mcat.rate_sheets (source_file, issued_on, currency, assumed_year)
  values ('rate sheet 0901.xlsx', '2026-09-01'::date,
          'USD', 2026)
  on conflict (source_file, issued_on) do update set imported_at = now()
  returning id into v_sheet;

  -- Reimportação substitui apenas as linhas DESTA rate sheet (cascade nas filhas).
  delete from mcat.freight_routes where rate_sheet_id = v_sheet;
  delete from mcat.rate_issues    where rate_sheet_id = v_sheet;

  insert into mcat.freight_routes (rate_sheet_id, carrier_id, pol_id, pod_id, trade_lane,
    service_type, service_name, validity_start, validity_end, validity_raw, vessel_ref,
    space_status, source_sheet, source_row, carrier_scope)
  select v_sheet, c.id, o.id, dst.id, t.trade_lane, t.service_type, t.service_name,
         nullif(t.validity_start,'')::date, nullif(t.validity_end,'')::date,
         t.validity_raw, t.vessel_ref, t.space_status, t.sheet, t.source_row, t.carrier_scope
    from mcat._stage_route t
    join mcat.carriers c on c.code     = t.carrier
    join mcat.ports    o on o.unlocode = t.pol
    join mcat.ports  dst on dst.unlocode = t.pod;

  get diagnostics v_rotas = row_count;

  -- Liga o id do ETL ao uuid gravado pela chave natural (aba, linha, POL, POD),
  -- única por construção do ETL — é o que dispensa um INSERT por rota.
  insert into mcat._stage_map (route_key, route_id)
  select t.route_key, r.id
    from mcat.freight_routes r
    join mcat.ports    o on o.id   = r.pol_id
    join mcat.ports  dst on dst.id = r.pod_id
    join mcat._stage_route t
      on t.sheet = r.source_sheet and t.source_row = r.source_row
     and t.pol = o.unlocode and t.pod = dst.unlocode
   where r.rate_sheet_id = v_sheet;

  insert into mcat.equipment_rates (route_id, equipment_type, also_valid_for, base_rate,
    currency, unit, adjusted_rate, weight_operator, weight_limit_ton, weight_basis,
    cargo_type, rate_source, raw_cell)
  select m.route_id, s.equipment_type, s.also_valid_for, s.base_rate, s.currency, s.unit,
         s.adjusted_rate, s.weight_operator, s.weight_limit_ton, s.weight_basis,
         s.cargo_type, s.rate_source, s.raw_cell
    from mcat._stage_rate s join mcat._stage_map m on m.route_key = s.route_key;

  get diagnostics v_tarifas = row_count;

  insert into mcat.rate_surcharges (route_id, fee_code, fee_label, amount, currency,
    charge_basis, equipment_type, min_weight_ton, condition_raw, source_column)
  select m.route_id, s.fee_code, s.fee_label, s.amount, s.currency, s.charge_basis,
         s.equipment_type, s.min_weight_ton, s.condition_raw, s.source_column
    from mcat._stage_surcharge s join mcat._stage_map m on m.route_key = s.route_key;

  insert into mcat.free_time_rules (route_id, free_days_pol, free_days_pod, raw)
  select m.route_id, t.free_days_pol, t.free_days_pod, t.free_time_raw
    from mcat._stage_route t join mcat._stage_map m on m.route_key = t.route_key
   where t.free_days_pol is not null;

  insert into mcat.rate_issues (rate_sheet_id, source_sheet, source_row, severity, kind, detail)
  select v_sheet, sheet, source_row, severity, kind, detail from mcat._stage_issue;

  -- A carga só vale se bater com o que o ETL apurou.
  if v_rotas <> 1273 then
    raise exception 'rotas: gravadas %, esperadas 1273 (portos ou armadores faltando?)', v_rotas;
  end if;
  if v_tarifas <> 2966 then
    raise exception 'tarifas: gravadas %, esperadas 2966', v_tarifas;
  end if;
end $$;

drop table if exists mcat._stage_route, mcat._stage_rate, mcat._stage_surcharge,
                     mcat._stage_issue, mcat._stage_map;

commit;

-- Confirmação. Esperado: 2966 cotações, 1273 rotas.
select (select count(*) from mcat.v_freight_quotes)                as cotacoes,
       (select count(*) from mcat.freight_routes)                  as rotas,
       (select count(*) from mcat.rate_issues)                     as ressalvas,
       (to_regclass('mcat._stage_route') is null)                  as staging_limpo;
