/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Executa as migrations e o seed de frete contra um PostgreSQL REAL.
 *
 * POR QUE ISTO EXISTE: validar a sintaxe com um parser não basta. Duas falhas
 * chegaram ao usuário justamente por passarem no parser e quebrarem na execução:
 *
 *   1. "relation mcat._stage_route does not exist" — a parte C do seed apagava o
 *      staging e não sobrevivia a uma segunda execução.
 *   2. "42P16: cannot change name of view column" — CREATE OR REPLACE VIEW só
 *      aceita colunas novas NO FIM; as de geografia entravam no meio.
 *
 * Nenhuma das duas é erro de gramática. Só executando aparecem.
 *
 * PGlite é o próprio PostgreSQL compilado para WASM: roda em processo, sem
 * Docker e sem servidor. Não substitui um teste contra o Supabase — extensões e
 * roles diferem — mas cobre exatamente a classe de erro acima.
 *
 * Uso: npm run test:sql
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
// pgcrypto não vem carregado por padrão no PGlite; a migration 0003 o exige.
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0;
const ok = (nome, cond, extra = '') => {
  if (!cond) falhas++;
  console.log(`  ${cond ? 'OK  ' : 'FALHA'} ${nome}${extra ? ` — ${extra}` : ''}`);
};

async function rodar(db, rotulo, sql) {
  try {
    await db.exec(sql);
    console.log(`  OK   ${rotulo}`);
    return true;
  } catch (e) {
    falhas++;
    console.log(`  FALHA ${rotulo}\n         ${String(e.message).split('\n')[0]}`);
    return false;
  }
}

const main = async () => {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  const { rows: [v] } = await db.query('select version()');
  console.log(`${v.version.split(',')[0]}\n`);

  // O Supabase traz estes roles de fábrica; o Postgres cru, não. Sem eles os
  // GRANTs da migration falhariam por um motivo que não é o que queremos testar.
  console.log('Preparo:');
  await rodar(db, 'roles do Supabase (anon, authenticated, service_role)',
    'create role anon; create role authenticated; create role service_role;');

  console.log('\nMigrations:');
  await rodar(db, 'migrations/0003_freight.sql', ler('migrations', '0003_freight.sql'));
  await rodar(db, 'migrations/0004_freight_geo.sql', ler('migrations', '0004_freight_geo.sql'));
  await rodar(db, 'migrations/0005_local_charges.sql', ler('migrations', '0005_local_charges.sql'));

  console.log('\nSeed (na ordem em que o SQL Editor deve rodar):');
  const dir = path.join(RAIZ, 'seeds', 'freight');
  const partes = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of partes) await rodar(db, `seeds/freight/${f}`, ler('seeds', 'freight', f));

  // ---- Conferência contra o que o ETL apurou -----------------------------
  console.log('\nConferência:');
  const d = JSON.parse(ler('src', 'data', 'freightRates.json'));
  const n = async (sql) => Number((await db.query(sql)).rows[0].c);

  ok('portos', await n('select count(*) c from mcat.ports') === d.ports.length,
    `esperado ${d.ports.length}`);
  ok('armadores', await n('select count(*) c from mcat.carriers') === d.carriers.length,
    `esperado ${d.carriers.length}`);
  ok('rotas', await n('select count(*) c from mcat.freight_routes') === d.routes.length,
    `esperado ${d.routes.length}`);
  ok('cotações na view', await n('select count(*) c from mcat.v_freight_quotes') === d.quotes.length,
    `esperado ${d.quotes.length}`);
  ok('taxas', await n('select count(*) c from mcat.rate_surcharges')
    === d.routes.reduce((s, r) => s + r.surcharges.length, 0));
  ok('ressalvas', await n('select count(*) c from mcat.rate_issues') === d.issues.length,
    `esperado ${d.issues.length}`);
  ok('staging removido', await n(
    "select count(*) c from information_schema.tables where table_schema='mcat' and table_name like '\\_stage%'") === 0);
  ok('coordenadas gravadas', await n('select count(*) c from mcat.ports where lat is null') === 0);

  // A view precisa expor a geografia na ordem certa — foi aqui que quebrou.
  const { rows: cols } = await db.query(
    `select column_name from information_schema.columns
      where table_schema='mcat' and table_name='v_freight_quotes' order by ordinal_position`);
  const nomes = cols.map((c) => c.column_name);
  ok('view expõe pol_lat/pol_lon/pod_lat/pod_lon',
    ['pol_lat', 'pol_lon', 'pod_lat', 'pod_lon'].every((c) => nomes.includes(c)));

  // ---- A consulta que a aplicação realmente faz --------------------------
  const { rows: q } = await db.query(
    `select carrier, base_rate, adjusted_rate, weight_limit_ton, weight_basis,
            surcharges_fixas_usd, status_validade, pol_lat, pod_lat
       from mcat.v_freight_quotes
      where pol = 'CNXMN' and pod = 'BRIOA' and equipment_type = '40HQ' and cargo_type is null
      order by base_rate`);
  ok('Xiamen -> Itapoá 40HQ devolve linhas', q.length > 0, `${q.length} cotações`);
  const pil = q.find((r) => r.carrier === 'PIL');
  ok('PIL 9700 com faixa 9400 <= 16 t CARGO (Brasil!L14)',
    !!pil && Number(pil.base_rate) === 9700 && Number(pil.adjusted_rate) === 9400
      && Number(pil.weight_limit_ton) === 16 && pil.weight_basis === 'CARGO',
    pil ? `base=${pil.base_rate} adj=${pil.adjusted_rate} ${pil.weight_limit_ton}t ${pil.weight_basis}` : 'não encontrada');
  ok('ISPS 15 somado em surcharges_fixas_usd', !!pil && Number(pil.surcharges_fixas_usd) === 15);
  ok('geografia disponível na view', !!pil && pil.pol_lat != null && pil.pod_lat != null);

  // Override por POD: Shanghai -> Rio tem tarifa própria (Brasil!L38).
  const { rows: rio } = await db.query(
    `select pod, base_rate from mcat.v_freight_quotes
      where pol='CNSHA' and equipment_type='20GP' and source_row=38 and source_sheet='Brasil'
      order by pod`);
  const doRio = rio.find((r) => r.pod === 'BRRIO');
  const outro = rio.find((r) => r.pod !== 'BRRIO');
  ok('override por POD preservado (RIO 8610 vs 8910 nos demais)',
    !!doRio && !!outro && Number(doRio.base_rate) === 8610 && Number(outro.base_rate) === 8910,
    doRio && outro ? `RIO=${doRio.base_rate} ${outro.pod}=${outro.base_rate}` : 'não encontrado');

  // ---- A consulta do modo FREIGHT_SOURCE=db ------------------------------
  // É o caminho que o servidor usa quando lê do Postgres em vez da base
  // embarcada. Nunca tinha sido executado contra um banco de verdade.
  const { rows: db1 } = await db.query(`
    select q.*, coalesce((
      select json_agg(json_build_object(
        'fee_code', s.fee_code, 'fee_label', s.fee_label, 'amount', s.amount,
        'currency', s.currency, 'charge_basis', s.charge_basis,
        'equipment_type', s.equipment_type, 'min_weight_ton', s.min_weight_ton,
        'condition_raw', s.condition_raw, 'source_column', s.source_column))
      from mcat.rate_surcharges s where s.route_id = q.route_id), '[]'::json) as surcharges
    from mcat.v_freight_quotes q`);
  ok('consulta de carregarDoBanco() roda e devolve tudo', db1.length === d.quotes.length,
    `${db1.length} linhas`);
  const comTaxa = db1.find((r) => Array.isArray(r.surcharges) && r.surcharges.length > 0);
  ok('surcharges agregadas como JSON utilizável',
    !!comTaxa && typeof comTaxa.surcharges[0].fee_code === 'string',
    comTaxa ? `ex.: ${comTaxa.surcharges[0].fee_code} ${comTaxa.surcharges[0].amount}` : 'nenhuma');
  ok('todos os campos que FreightQuote espera existem na view',
    ['quote_id', 'route_id', 'carrier', 'pol', 'pol_name', 'pod', 'pod_name', 'pod_country',
     'equipment_type', 'also_valid_for', 'base_rate', 'adjusted_rate', 'weight_operator',
     'weight_limit_ton', 'weight_basis', 'cargo_type', 'unit', 'currency', 'free_days_pol',
     'free_days_pod', 'source_sheet', 'source_row', 'status_validade']
      .every((c) => c in db1[0]));

  // ---- Taxas locais e custo total ---------------------------------------
  // Os valores esperados abaixo foram apurados A MAO na planilha de origem
  // (aba unica, linhas 457-462 e 475-478), nao extraidos do proprio banco.
  // Conferir o banco contra ele mesmo nao prova nada.
  console.log('\nTaxas locais de destino:');
  ok('639 taxas carregadas', await n('select count(*) c from mcat.local_charges') === 639);
  ok('12 portos com taxa local',
    await n('select count(distinct port_unlocode) c from mcat.local_charges') === 12);
  ok('nenhuma taxa orfa de porto (FK real com ports)',
    await n(`select count(*) c from mcat.local_charges lc
              left join mcat.ports p on p.unlocode = lc.port_unlocode
             where p.unlocode is null`) === 0);
  ok('agente de carga separado do armador',
    await n(`select count(distinct entity_name) c from mcat.local_charges
              where entity_type = 'FREIGHT_FORWARDER'`) === 1);
  ok('24 ressalvas de unidade divergente (ONE: THC e BL FEE)',
    await n(`select count(*) c from mcat.charge_issues where kind = 'unidade_divergente'`) === 24);

  // Todo armador das taxas locais precisa existir em carriers, senao a funcao
  // de custo total devolve zero sem reclamar.
  ok('todo armador das taxas existe em carriers',
    await n(`select count(*) c from (
               select distinct lc.entity_name from mcat.local_charges lc
                where lc.entity_type = 'CARRIER'
                  and not exists (select 1 from mcat.carriers c where c.code = lc.entity_name)
             ) x`) === 0);

  console.log('\nCusto total (Xiamen -> Itapoa, PIL, 40HQ, 2 conteineres, USD/BRL 5,40):');
  const { rows: [t] } = await db.query(
    `select * from mcat.total_freight_cost('CNXMN','BRIOA','PIL','40HQ', 2, 5.40)`);
  ok('funcao devolve uma linha', !!t);
  ok('frete internacional 9700 x 2 = 19400', Number(t.ocean_freight_usd) === 19400,
    `veio ${t && t.ocean_freight_usd}`);
  ok('surcharges 15 x 2 = 30', Number(t.surcharges_usd) === 30);
  ok('local por BL: BRL 620 (nao multiplicado por conteiner)',
    Number(t.local_bl_brl) === 620, `veio ${t && t.local_bl_brl}`);
  ok('local por BL: USD 200 (DESCO 100 + TRS 30 + COURIER 70)',
    Number(t.local_bl_usd) === 200, `veio ${t && t.local_bl_usd}`);
  ok('local por CNTR: BRL 1370 x 2 = 2740',
    Number(t.local_cntr_brl) === 2740, `veio ${t && t.local_cntr_brl}`);
  ok('local por CNTR: USD 121 x 2 = 242',
    Number(t.local_cntr_usd) === 242, `veio ${t && t.local_cntr_usd}`);
  ok('custo local em USD = 1064,22', Number(t.local_total_usd) === 1064.22,
    `veio ${t && t.local_total_usd}`);
  ok('TOTAL USD = 20494,22', Number(t.total_usd) === 20494.22, `veio ${t && t.total_usd}`);
  ok('TOTAL BRL = 110668,80', Number(t.total_brl) === 110668.80, `veio ${t && t.total_brl}`);
  ok('PIL nao carrega ressalva', t && t.tem_ressalva_taxas === false);

  // Sem o agente de carga, some exatamente o que ele cobra: USD 200 por BL e
  // USD 50 por conteiner.
  const { rows: [semAg] } = await db.query(
    `select * from mcat.total_freight_cost('CNXMN','BRIOA','PIL','40HQ', 2, 5.40, false)`);
  ok('excluir agente de carga tira USD 200 do BL', Number(semAg.local_bl_usd) === 0);
  ok('excluir agente de carga tira USD 50 x 2 do CNTR',
    Number(semAg.local_cntr_usd) === Number(t.local_cntr_usd) - 100,
    `veio ${semAg.local_cntr_usd}`);

  // A ONE precisa chegar ao usuario com a ressalva junto.
  const { rows: one } = await db.query(
    `select * from mcat.total_freight_cost('CNSHA','BRSSZ','ONE','40HQ', 3, 5.40)`);
  if (one.length > 0) {
    ok('ONE sinaliza ressalva de unidade', one[0].tem_ressalva_taxas === true,
      `ressalvas=${one[0].ressalvas && one[0].ressalvas.length}`);
    ok('a ressalva explica o risco', Array.isArray(one[0].ressalvas)
      && one[0].ressalvas.some((r) => r.includes('THC') || r.includes('BL FEE')));
  } else {
    ok('ONE em Shanghai->Santos 40HQ existe na base', false, 'par nao encontrado');
  }

  // BL e cobrado UMA vez; CNTR escala. Dobrar os conteineres nao pode dobrar
  // o total — se dobrar, a unidade esta sendo ignorada.
  const { rows: [um] } = await db.query(
    `select * from mcat.total_freight_cost('CNXMN','BRIOA','PIL','40HQ', 1, 5.40)`);
  const { rows: [dois] } = await db.query(
    `select * from mcat.total_freight_cost('CNXMN','BRIOA','PIL','40HQ', 2, 5.40)`);
  ok('taxa por BL nao escala com o numero de conteineres',
    Number(um.local_bl_brl) === Number(dois.local_bl_brl)
    && Number(um.local_bl_usd) === Number(dois.local_bl_usd));
  ok('taxa por CNTR escala exatamente 2x',
    Number(dois.local_cntr_brl) === Number(um.local_cntr_brl) * 2
    && Number(dois.local_cntr_usd) === Number(um.local_cntr_usd) * 2);
  ok('dobrar conteineres NAO dobra o total (o BL fica)',
    Number(dois.total_usd) < Number(um.total_usd) * 2,
    `1x=${um.total_usd} 2x=${dois.total_usd}`);

  ok('view de resumo devolve as 4 combinacoes unidade x moeda',
    await n(`select count(*) c from mcat.v_local_charges_summary
              where port_code = 'IOA' and entity_name = 'PIL'`) === 1);

  // ---- Re-execução: o defeito que chegou ao usuário ----------------------
  console.log('\nRe-execução da parte C (o erro que você viu):');
  const c = partes.find((f) => f.includes('_c_load'));
  const reOk = await rodar(db, `${c} rodado uma segunda vez`, ler('seeds', 'freight', c));
  ok('dados intactos após re-execução',
    reOk && await n('select count(*) c from mcat.v_freight_quotes') === d.quotes.length);

  // Mesmo risco na 0005: no SQL Editor do Supabase o segundo clique é comum.
  // `create type` não aceita `if not exists`, então a migration precisa do
  // guard — sem ele, a segunda execução morre em "type already exists".
  const m5 = await rodar(db, 'migrations/0005_local_charges.sql rodada de novo',
    ler('migrations', '0005_local_charges.sql'));
  const s5 = await rodar(db, 'seeds/freight/0005_local_charges.sql rodado de novo',
    ler('seeds', 'freight', '0005_local_charges.sql'));
  ok('taxas não duplicaram na re-execução',
    m5 && s5 && await n('select count(*) c from mcat.local_charges') === 639);
  ok('ressalvas não duplicaram na re-execução',
    await n(`select count(*) c from mcat.charge_issues where kind = 'unidade_divergente'`) === 24);
  const { rows: [dep] } = await db.query(
    `select * from mcat.total_freight_cost('CNXMN','BRIOA','PIL','40HQ', 2, 5.40)`);
  ok('custo total idêntico após re-execução', Number(dep.total_usd) === 20494.22,
    `veio ${dep && dep.total_usd}`);

  console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
  await db.close();
  process.exit(falhas === 0 ? 0 : 1);
};

main();
