/**
 * Teste do motor de frete (src/engine/freight.ts). Roda com: npm run test:freight
 *
 * Cobre as regras que mudam o número na fatura: faixa de peso, a diferença
 * VGM × peso de mercadoria, taxas escalonadas de excesso e vigência. Os casos
 * usam células REAIS da rate sheet 0901 (aba e linha citadas em cada bloco).
 */
import { cotar, distanciaNm, estimarTransito, ordenarPorCusto, pesoNaBase, temTarifaSuspeita, FreightQuote, Surcharge } from '../src/engine/freight';

let falhas = 0;
const eq = (nome: string, got: unknown, exp: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) falhas++;
  console.log(`  ${ok ? 'OK ' : 'FAIL'}  ${nome}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
};
const contem = (nome: string, arr: string[], trecho: string) => {
  const ok = arr.some((a) => a.includes(trecho));
  if (!ok) falhas++;
  console.log(`  ${ok ? 'OK ' : 'FAIL'}  ${nome}${ok ? '' : ` :: ${JSON.stringify(arr)}`}`);
};

const HOJE = '2026-09-01';

const base: FreightQuote = {
  quote_id: 1, route_id: 1, carrier: 'PIL', carrier_scope: [], trade_lane: 'Brasil',
  pol: 'CNXMN', pol_name: 'Xiamen', pol_lat: 24.48, pol_lon: 118.09,
  pod: 'BRIOA', pod_name: 'Itapoá', pod_country: 'BR', pod_lat: -26.11, pod_lon: -48.61,
  service_type: 'Direct', service_name: 'Direct',
  validity_start: '2026-09-01', validity_end: '2026-09-07', validity_raw: '9.01~9.07',
  vessel_ref: 'KOTA MACHAN 0551S', space_status: null,
  equipment_type: '40HQ', also_valid_for: ['40GP'],
  base_rate: 9700, adjusted_rate: 9400, weight_operator: '<=', weight_limit_ton: 16,
  weight_basis: 'CARGO', cargo_type: null, unit: 'CONTAINER', currency: 'USD',
  free_days_pol: 21, free_days_pod: 18,
  surcharges: [{
    fee_code: 'ISPS', fee_label: 'isps', amount: 15, currency: 'USD',
    charge_basis: 'PER_CONTAINER', equipment_type: null, min_weight_ton: null,
    condition_raw: 'isps usd15', source_column: 'subject_to',
  }],
  source_sheet: 'Brasil', source_row: 14,
};

// ---- A: faixa de peso em base CARGO (Brasil!L14 — "9700，（9400<=16ton cargo weight)")
console.log('Caso A — faixa de peso sobre peso de mercadoria:');
const a1 = cotar(base, { pesoTon: 15, pesoInformadoComo: 'CARGO', hoje: HOJE });
eq('15 t libera a faixa', a1.tarifaAplicada, 9400);
eq('desconto', a1.descontoPeso, 300);
eq('total = 9400 + ISPS 15', a1.totalUsd, 9415);
const a2 = cotar(base, { pesoTon: 18, pesoInformadoComo: 'CARGO', hoje: HOJE });
eq('18 t fica na base', a2.tarifaAplicada, 9700);
eq('sem desconto', a2.descontoPeso, 0);
const a3 = cotar(base, { hoje: HOJE });
eq('sem peso informado -> base', a3.tarifaAplicada, 9700);
contem('avisa que existe faixa não avaliada', a3.alertas, 'Informe o peso');

// ---- B: a armadilha do VGM (Brasil!L21 — "9200，（9000<=18ton vgm）")
// 15 t de carga num 40'HQ são ~18,9 t de VGM: a faixa NÃO se aplica.
console.log('\nCaso B — limite em VGM contra peso de mercadoria:');
const vgm: FreightQuote = {
  ...base, base_rate: 9200, adjusted_rate: 9000, weight_limit_ton: 18,
  weight_basis: 'VGM', source_row: 21,
};
eq('conversão CARGO->VGM em 40HQ', pesoNaBase(15, 'CARGO', 'VGM', '40HQ'), { peso: 18.9, convertido: true });
const b1 = cotar(vgm, { pesoTon: 15, pesoInformadoComo: 'CARGO', hoje: HOJE });
eq('15 t de carga NÃO libera faixa de 18 t VGM', b1.tarifaAplicada, 9200);
contem('explica por que não aplicou', b1.alertas, 'NÃO se aplica');
const b2 = cotar(vgm, { pesoTon: 15, pesoInformadoComo: 'VGM', hoje: HOJE });
eq('15 t já em VGM libera a faixa', b2.tarifaAplicada, 9000);
const b3 = cotar(vgm, { pesoTon: 13, pesoInformadoComo: 'CARGO', hoje: HOJE });
eq('13 t de carga (16,9 VGM) libera', b3.tarifaAplicada, 9000);
contem('mostra a conta do VGM', b3.alertas, 'tara');

// ---- C: OWS escalonado (Brasil!L29 — "OWS USD200/20GP >14 ton, USD500/20GP >20ton")
console.log('\nCaso C — excesso de peso escalonado, não cumulativo:');
const ows: Surcharge[] = [
  { fee_code: 'ISPS', fee_label: 'isps', amount: 14, currency: 'USD', charge_basis: 'PER_CONTAINER',
    equipment_type: null, min_weight_ton: null, condition_raw: 'isps usd14', source_column: 'subject_to' },
  { fee_code: 'OWS', fee_label: 'OWS /20GP', amount: 200, currency: 'USD', charge_basis: 'PER_CONTAINER',
    equipment_type: '20GP', min_weight_ton: 14, condition_raw: 'OWS USD200/20GP >14 ton', source_column: 'remark' },
  { fee_code: 'OWS', fee_label: 'OWS /20GP', amount: 500, currency: 'USD', charge_basis: 'PER_CONTAINER',
    equipment_type: '20GP', min_weight_ton: 20, condition_raw: 'USD500/20GP >20ton', source_column: 'remark' },
];
const yml: FreightQuote = {
  ...base, carrier: 'YML', equipment_type: '20GP', also_valid_for: [], base_rate: 8700,
  adjusted_rate: null, weight_operator: null, weight_limit_ton: null, weight_basis: null,
  surcharges: ows, free_days_pol: 28, free_days_pod: 17, source_row: 29,
};
eq('10 t: só ISPS', cotar(yml, { pesoTon: 10, hoje: HOJE }).totalUsd, 8714);
eq('16 t: ISPS + OWS 200', cotar(yml, { pesoTon: 16, hoje: HOJE }).totalUsd, 8914);
eq('22 t: ISPS + OWS 500 (não 200+500)', cotar(yml, { pesoTon: 22, hoje: HOJE }).totalUsd, 9214);

// Taxa amarrada a 20GP não pode incidir num 40HQ.
const yml40 = cotar({ ...yml, equipment_type: '40HQ' }, { pesoTon: 22, hoje: HOJE });
eq('OWS de 20GP não incide em 40HQ', yml40.totalUsd, 8714);

// ---- D: vigência
console.log('\nCaso D — vigência governa a ordenação:');
eq('vigente', cotar(base, { hoje: HOJE }).status, 'vigente');
eq('expirando (fim em 2026-09-03)', cotar({ ...base, validity_end: '2026-09-03' }, { hoje: HOJE }).status, 'expirando');
const exp = cotar({ ...base, validity_end: '2026-04-04', base_rate: 1900, adjusted_rate: null,
  weight_operator: null, weight_limit_ton: null }, { hoje: HOJE });
eq('expirado', exp.status, 'expirado');
contem('alerta de expiração', exp.alertas, 'expirada');
const ordem = ordenarPorCusto([exp, cotar(base, { pesoTon: 15, hoje: HOJE })]);
eq('a mais barata expirada NÃO lidera', ordem[0].status, 'vigente');

// ---- E: tarifa restrita a mercadoria (Brasil!L49 — "8500 (Tyre)")
console.log('\nCaso E — tarifa restrita a mercadoria e LCL:');
const pneu = cotar({ ...base, cargo_type: 'PNEU', base_rate: 8500, adjusted_rate: null,
  weight_operator: null, weight_limit_ton: null }, { hoje: HOJE });
contem('avisa restrição de carga', pneu.alertas, 'restrita a pneu');
const lcl = cotar({ ...base, unit: 'CBM', equipment_type: 'LCL', base_rate: 1, adjusted_rate: null,
  weight_operator: null, weight_limit_ton: null, surcharges: [] }, { cbm: 12, hoje: HOJE });
eq('LCL cobra por m³', lcl.totalUsd, 12);

// ---- F: trânsito estimado (a planilha não declara — é derivado) ------------
console.log('\nCaso F — trânsito estimado por distância real:');
const perto = (a: number, b: number) => Math.abs(a - b) <= 60;
eq('Shanghai->Santos ~10.026 nm', perto(distanciaNm(31.23, 121.47, -23.96, -46.33), 10026), true);
const coordSSZ = { pol_lat: 31.23, pol_lon: 121.47, pod_lat: -23.96, pod_lon: -46.33 };
const tDireto = estimarTransito({ ...base, ...coordSSZ })!;
eq('33 dias — os serviços diretos reais desse par ficam entre 30 e 35', tDireto.dias, 33);
eq('marcado como estimado', tDireto.estimado, true);
const tTransbordo = estimarTransito({ ...base, ...coordSSZ, service_type: 'Transhipment' })!;
eq('transbordo soma 7 dias sobre o direto', tTransbordo.dias - tDireto.dias, 7);
eq('sem coordenadas não estima', estimarTransito({ ...base, pol_lat: null, pol_lon: null }), null);

// ---- G: tarifa com ressalva de qualidade não pode liderar ------------------
// Brasil!L23 traz "1000" onde deveria haver "10000" (a PIL de Chongqing).
console.log('\nCaso G — tarifa corrompida não lidera o ranking:');
const suspeita: FreightQuote = {
  ...base, base_rate: 1000, adjusted_rate: null, weight_operator: null,
  weight_limit_ton: null, weight_basis: null, surcharges: [], source_row: 23,
  data_issues: [{ kind: 'tarifa', severity: 'aviso', detail: 'tarifa_base_menor_que_desconto' }],
};
const cSuspeita = cotar(suspeita, { hoje: HOJE });
const cLimpa = cotar(base, { pesoTon: 15, hoje: HOJE });
eq('detecta a ressalva de tarifa', temTarifaSuspeita(cSuspeita), true);
eq('cotação limpa não é marcada', temTarifaSuspeita(cLimpa), false);
eq('a suspeita custa 1/9 e mesmo assim NÃO lidera',
  ordenarPorCusto([cSuspeita, cLimpa])[0].quote.source_row, 14);
contem('a ressalva chega ao usuário como alerta', cSuspeita.alertas, 'Qualidade do dado');
// Ressalva que não é de tarifa (porto fora do dicionário) não desqualifica preço.
const outraRessalva = cotar(
  { ...base, data_issues: [{ kind: 'porto_nao_mapeado', severity: 'aviso', detail: 'Shanshan' }] },
  { pesoTon: 15, hoje: HOJE },
);
eq('ressalva de porto não desqualifica a tarifa', temTarifaSuspeita(outraRessalva), false);

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
