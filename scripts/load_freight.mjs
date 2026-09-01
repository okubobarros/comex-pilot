/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Carrega a rate sheet desagrupada no Postgres/Supabase.
 *
 * POR QUE ISTO EXISTE: o SQL Editor do Supabase recusa scripts grandes
 * ("Query is too large to be run via the SQL Editor"), e a carga tem ~5.600
 * linhas. Aqui os dados vão por `unnest` de arrays — UMA instrução por tabela,
 * parametrizada — em vez de milhares de INSERTs em texto. Além de caber, roda
 * em segundos e não corre risco de aspas mal escapadas.
 *
 * Uso:
 *   node scripts/load_freight.mjs --check    # só verifica (não escreve nada)
 *   node scripts/load_freight.mjs            # carrega
 *
 * Idempotente: reimportar a mesma rate sheet substitui apenas as linhas dela.
 * Requer DATABASE_URL e a migration migrations/0003_freight.sql aplicada.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOMENTE_CHECAR = process.argv.includes('--check');

const TABELAS = [
  'carriers', 'ports', 'rate_sheets', 'freight_routes',
  'equipment_rates', 'rate_surcharges', 'free_time_rules', 'rate_issues',
];

/** Transpõe [{a,b}] em {a:[...], b:[...]} — o formato que o unnest consome. */
const colunas = (linhas, campos) => campos.map((f) => linhas.map((l) => l[f] ?? null));

/** $1..$n para a lista de arrays, com o tipo que o Postgres precisa ver. */
const placeholders = (tipos, offset = 0) =>
  tipos.map((t, i) => `$${i + 1 + offset}::${t}[]`).join(', ');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida (.env). Nada a fazer.');
    process.exit(1);
  }

  const arquivo = path.join(RAIZ, 'src', 'data', 'freightRates.json');
  if (!fs.existsSync(arquivo)) {
    console.error(`${arquivo} não existe. Rode antes: npm run etl:freight`);
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const rs = d.rate_sheet;

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
  } catch (e) {
    // O .env do repo traz um placeholder ("@host:5432"); sem isto o erro sai
    // como stack trace de DNS e não diz o que precisa ser preenchido.
    console.error(`Não consegui conectar: ${e.message}`);
    console.error('Confira DATABASE_URL no .env — a connection string do Supabase está em');
    console.error('Project Settings > Database > Connection string > URI.');
    process.exit(1);
  }

  try {
    // ---- Pré-voo: a migration está aplicada? -----------------------------
    const { rows: existentes } = await client.query(
      `select table_name from information_schema.tables
        where table_schema = 'mcat' and table_name = any($1)`,
      [TABELAS],
    );
    const faltando = TABELAS.filter((t) => !existentes.some((e) => e.table_name === t));
    if (faltando.length) {
      console.error('Tabelas ausentes no schema mcat:', faltando.join(', '));
      console.error('Aplique migrations/0003_freight.sql antes de carregar.');
      process.exit(1);
    }
    console.log(`schema mcat  : ${TABELAS.length} tabelas presentes`);
    console.log(`arquivo      : ${rs.source_file} (emissão ${rs.issued_on})`);
    console.log(`a carregar   : ${d.ports.length} portos, ${d.carriers.length} armadores, ` +
                `${d.routes.length} rotas, ${d.quotes.length} cotações, ${d.issues.length} ressalvas`);

    if (SOMENTE_CHECAR) {
      const { rows: [atual] } = await client.query(
        `select count(*)::int as n from mcat.freight_routes r
          join mcat.rate_sheets s on s.id = r.rate_sheet_id where s.source_file = $1`,
        [rs.source_file],
      );
      console.log(`já no banco  : ${atual.n} rotas desta rate sheet`);
      console.log('\n--check: nada foi escrito. Para carregar: node scripts/load_freight.mjs');
      return;
    }

    await client.query('begin');

    // ---- Dimensões -------------------------------------------------------
    await client.query(
      `insert into mcat.ports (unlocode, name, country)
       select * from unnest(${placeholders(['char', 'text', 'char'])})
       on conflict (unlocode) do update set name = excluded.name`,
      colunas(d.ports, ['unlocode', 'name', 'country']),
    );
    await client.query(
      `insert into mcat.carriers (code, name)
       select * from unnest(${placeholders(['text', 'text'])})
       on conflict (code) do update set name = excluded.name`,
      colunas(d.carriers, ['code', 'name']),
    );

    // ---- Rate sheet ------------------------------------------------------
    const { rows: [sheet] } = await client.query(
      `insert into mcat.rate_sheets (source_file, issued_on, currency, assumed_year)
       values ($1, $2::date, $3, $4)
       on conflict (source_file, issued_on) do update set imported_at = now()
       returning id`,
      [rs.source_file, rs.issued_on, rs.currency, rs.assumed_year],
    );
    const sheetId = sheet.id;

    // Reimportação substitui só as linhas desta rate sheet (cascade nas filhas).
    const del = await client.query('delete from mcat.freight_routes where rate_sheet_id = $1', [sheetId]);
    await client.query('delete from mcat.rate_issues where rate_sheet_id = $1', [sheetId]);
    if (del.rowCount) console.log(`substituindo : ${del.rowCount} rotas da importação anterior`);

    // ---- Rotas -----------------------------------------------------------
    const rotas = d.routes.map((r) => ({
      ...r,
      carrier_scope: r.carrier_scope?.length ? r.carrier_scope.join(',') : null,
    }));
    const camposRota = ['carrier', 'pol', 'pod', 'trade_lane', 'service_type', 'service_name',
      'validity_start', 'validity_end', 'validity_raw', 'vessel_ref', 'space_status',
      'sheet', 'source_row', 'carrier_scope'];
    await client.query(
      `insert into mcat.freight_routes (rate_sheet_id, carrier_id, pol_id, pod_id, trade_lane,
         service_type, service_name, validity_start, validity_end, validity_raw, vessel_ref,
         space_status, source_sheet, source_row, carrier_scope)
       select $1, c.id, o.id, dst.id, t.trade_lane, t.service_type, t.service_name,
              t.validity_start, t.validity_end, t.validity_raw, t.vessel_ref, t.space_status,
              t.sheet, t.source_row, t.carrier_scope
         from unnest(${placeholders(['text', 'char', 'char', 'text', 'text', 'text', 'date',
                                     'date', 'text', 'text', 'text', 'text', 'int', 'text'], 1)})
              as t(carrier, pol, pod, trade_lane, service_type, service_name, validity_start,
                   validity_end, validity_raw, vessel_ref, space_status, sheet, source_row,
                   carrier_scope)
         join mcat.carriers c   on c.code = t.carrier
         join mcat.ports o      on o.unlocode = t.pol
         join mcat.ports dst    on dst.unlocode = t.pod`,
      [sheetId, ...colunas(rotas, camposRota)],
    );

    // Mapeia o id do ETL -> uuid gravado, pela chave natural (aba, linha, POL, POD),
    // que é única por construção do ETL.
    const { rows: gravadas } = await client.query(
      `select r.id, r.source_sheet, r.source_row, o.unlocode as pol, dst.unlocode as pod
         from mcat.freight_routes r
         join mcat.ports o   on o.id = r.pol_id
         join mcat.ports dst on dst.id = r.pod_id
        where r.rate_sheet_id = $1`,
      [sheetId],
    );
    const chave = (s, l, a, b) => `${s}|${l}|${a}|${b}`;
    const uuidPorChave = new Map(
      gravadas.map((r) => [chave(r.source_sheet, r.source_row, r.pol, r.pod), r.id]),
    );
    const uuidDaRota = new Map(
      d.routes.map((r) => [r.id, uuidPorChave.get(chave(r.sheet, r.source_row, r.pol, r.pod))]),
    );
    const semUuid = [...uuidDaRota.values()].filter((v) => !v).length;
    if (semUuid) throw new Error(`${semUuid} rotas não puderam ser mapeadas — carga abortada`);
    console.log(`rotas        : ${gravadas.length} gravadas`);

    // ---- Tarifas por equipamento ----------------------------------------
    const tarifas = d.quotes.map((q) => ({
      route_id: uuidDaRota.get(q.route_id),
      equipment_type: q.equipment_type,
      also_valid_for: q.also_valid_for?.length ? q.also_valid_for.join(',') : null,
      base_rate: q.base_rate, currency: q.currency, unit: q.unit,
      adjusted_rate: q.adjusted_rate, weight_operator: q.weight_operator,
      weight_limit_ton: q.weight_limit_ton, weight_basis: q.weight_basis,
      cargo_type: q.cargo_type, rate_source: q.rate_source, raw_cell: q.raw_cell,
    }));
    await client.query(
      `insert into mcat.equipment_rates (route_id, equipment_type, also_valid_for, base_rate,
         currency, unit, adjusted_rate, weight_operator, weight_limit_ton, weight_basis,
         cargo_type, rate_source, raw_cell)
       select * from unnest(${placeholders(['uuid', 'text', 'text', 'numeric', 'char', 'text',
                                            'numeric', 'text', 'numeric', 'text', 'text',
                                            'text', 'text'])})`,
      colunas(tarifas, ['route_id', 'equipment_type', 'also_valid_for', 'base_rate', 'currency',
        'unit', 'adjusted_rate', 'weight_operator', 'weight_limit_ton', 'weight_basis',
        'cargo_type', 'rate_source', 'raw_cell']),
    );
    console.log(`tarifas      : ${tarifas.length} gravadas`);

    // ---- Taxas e free time ----------------------------------------------
    const taxas = d.routes.flatMap((r) =>
      r.surcharges.map((s) => ({ ...s, route_id: uuidDaRota.get(r.id) })));
    await client.query(
      `insert into mcat.rate_surcharges (route_id, fee_code, fee_label, amount, currency,
         charge_basis, equipment_type, min_weight_ton, condition_raw, source_column)
       select * from unnest(${placeholders(['uuid', 'text', 'text', 'numeric', 'char', 'text',
                                            'text', 'numeric', 'text', 'text'])})`,
      colunas(taxas, ['route_id', 'fee_code', 'fee_label', 'amount', 'currency', 'charge_basis',
        'equipment_type', 'min_weight_ton', 'condition_raw', 'source_column']),
    );

    const freeTime = d.routes
      .filter((r) => r.free_days_pol != null)
      .map((r) => ({
        route_id: uuidDaRota.get(r.id), free_days_pol: r.free_days_pol,
        free_days_pod: r.free_days_pod, raw: r.free_time_raw,
      }));
    await client.query(
      `insert into mcat.free_time_rules (route_id, free_days_pol, free_days_pod, raw)
       select * from unnest(${placeholders(['uuid', 'smallint', 'smallint', 'text'])})`,
      colunas(freeTime, ['route_id', 'free_days_pol', 'free_days_pod', 'raw']),
    );
    console.log(`taxas        : ${taxas.length} · free time: ${freeTime.length}`);

    // ---- Trilha de qualidade --------------------------------------------
    await client.query(
      `insert into mcat.rate_issues (rate_sheet_id, source_sheet, source_row, severity, kind, detail)
       select $1, * from unnest(${placeholders(['text', 'int', 'text', 'text', 'text'], 1)})`,
      [sheetId, ...colunas(d.issues, ['sheet', 'source_row', 'severity', 'kind', 'detail'])],
    );

    // ---- Conferência dentro da transação ---------------------------------
    const { rows: [v] } = await client.query(
      'select count(*)::int as n from mcat.v_freight_quotes q join mcat.freight_routes r' +
      ' on r.id = q.route_id where r.rate_sheet_id = $1', [sheetId],
    );
    if (v.n !== d.quotes.length) {
      throw new Error(`v_freight_quotes devolveu ${v.n}, esperado ${d.quotes.length} — rollback`);
    }

    await client.query('commit');
    console.log(`\nOK — mcat.v_freight_quotes: ${v.n} cotações desta rate sheet.`);
  } catch (e) {
    await client.query('rollback').catch(() => {});
    console.error('\nFALHOU (rollback aplicado):', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
