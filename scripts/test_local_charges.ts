/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Teste do motor de taxas locais (src/engine/localCharges.ts).
 * Roda com: npm run test:taxas
 *
 * A MESMA conta existe em SQL (mcat.total_freight_cost) e aqui em TypeScript.
 * Duas implementações da mesma regra divergem com o tempo, então as duas são
 * conferidas contra os MESMOS valores — apurados à mão na planilha de origem,
 * linhas 457-462 (PIL em Itapoá) e 475-478 (agente de carga em Itapoá), não
 * extraídos de nenhuma das duas implementações.
 *
 * O caso de Itapoá é o mesmo de scripts/test_sql.mjs: se os dois testes
 * passarem com os mesmos números, as implementações concordam.
 */
import { calcularCustoLocal, porEntidade, rescalarPorContainers } from '../src/engine/localCharges';
import type { ChargeIssue, LocalCharge } from '../src/engine/localCharges';
import dataset from '../src/data/localCharges.json';

const charges = dataset.charges as LocalCharge[];
const issues = dataset.issues as ChargeIssue[];

let falhas = 0;
const eq = (nome: string, got: unknown, exp: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) falhas++;
  console.log(`  ${ok ? 'OK ' : 'FAIL'}  ${nome}`);
  if (!ok) console.log(`         got=${JSON.stringify(got)}  exp=${JSON.stringify(exp)}`);
};

console.log('Base embarcada:');
eq('639 taxas', charges.length, 639);
eq('24 ressalvas', issues.length, 24);
eq('12 portos', new Set(charges.map((c) => c.port_unlocode)).size, 12);

// ---------------------------------------------------------------------------
// Itapoá, PIL, 2 contêineres, USD/BRL 5,40 — conferido na planilha:
//   PIL:    BL FEE BRL 620 (BL) · THC BRL 1190 (CNTR) · DPP BRL 180 (CNTR)
//           ISPS USD 15 (CNTR) · TSC USD 21 (CNTR) · DROP OFF USD 35 (CNTR)
//   AGENTE: DESCO USD 100 (BL) · TRS USD 30 (BL) · COURIER USD 70 (BL)
//           HANDL USD 50 (CNTR)
// ---------------------------------------------------------------------------
console.log('\nItapoá · PIL · 2 contêineres · USD/BRL 5,40:');
const c = calcularCustoLocal(charges, issues, {
  pod: 'BRIOA', carrier: 'PIL', containers: 2, usdBrl: 5.4,
})!;
eq('encontrou o porto', !!c, true);
eq('BL em BRL = 620 (não multiplica por contêiner)', c.porBlBrl, 620);
eq('BL em USD = 200 (DESCO 100 + TRS 30 + COURIER 70)', c.porBlUsd, 200);
eq('CNTR em BRL = 1370 x 2 = 2740', c.porCntrBrl, 2740);
eq('CNTR em USD = 121 x 2 = 242', c.porCntrUsd, 242);
eq('total em USD = 1064,22', c.totalUsd, 1064.22);
// 620 + 2740 (já em BRL) + (200 + 242) x 5,40 = 5746,80.
eq('total em BRL = 5746,80', c.totalBrl, 5746.8);
eq('10 linhas de taxa', c.linhas.length, 10);
eq('PIL sem ressalva', c.ressalvas.length, 0);

// O mesmo número que o teste SQL confere para o custo TOTAL: frete 9700 x 2
// mais ISPS 15 x 2 mais este custo local.
eq('bate com o total do teste SQL (20494,22)',
  Math.round((9700 * 2 + 15 * 2 + c.totalUsd) * 100) / 100, 20494.22);

console.log('\nA unidade de cobrança governa a escala:');
const um = calcularCustoLocal(charges, issues, { pod: 'BRIOA', carrier: 'PIL', containers: 1, usdBrl: 5.4 })!;
const tres = calcularCustoLocal(charges, issues, { pod: 'BRIOA', carrier: 'PIL', containers: 3, usdBrl: 5.4 })!;
eq('taxa por BL é a mesma com 1 e com 3 contêineres',
  [um.porBlBrl, um.porBlUsd], [tres.porBlBrl, tres.porBlUsd]);
eq('taxa por CNTR triplica', [tres.porCntrBrl, tres.porCntrUsd],
  [um.porCntrBrl * 3, um.porCntrUsd * 3]);
eq('triplicar contêineres NÃO triplica o custo local', tres.totalUsd < um.totalUsd * 3, true);

console.log('\nAgente de carga:');
const semAgente = calcularCustoLocal(charges, issues, {
  pod: 'BRIOA', carrier: 'PIL', containers: 2, usdBrl: 5.4, incluirAgente: false,
})!;
eq('sem o agente somem os USD 200 por BL', semAgente.porBlUsd, 0);
eq('sem o agente somem USD 50 x 2 por contêiner', semAgente.porCntrUsd, c.porCntrUsd - 100);
eq('as taxas do armador não mudam', semAgente.porCntrBrl, c.porCntrBrl);
eq('agrupamento traz armador antes do agente',
  porEntidade(c).map((g) => g.tipo), ['CARRIER', 'FREIGHT_FORWARDER']);

// ---------------------------------------------------------------------------
// A divergência da ONE precisa CHEGAR ao usuário, não ser corrigida em silêncio.
// ---------------------------------------------------------------------------
console.log('\nRessalva da ONE (THC por BL, BL FEE por contêiner):');
const one = calcularCustoLocal(charges, issues, {
  pod: 'BRSSZ', carrier: 'ONE', containers: 3, usdBrl: 5.4,
})!;
eq('a ressalva é devolvida', one.ressalvas.length > 0, true);
eq('a ressalva cita THC ou BL FEE',
  one.ressalvas.some((r) => r.includes('THC') || r.includes('BL FEE')), true);
// O dado entra COMO ESTÁ: o THC de Santos da ONE (BRL 1600) está marcado como
// BL, então não escala. É justamente isso que a ressalva avisa.
eq('o dado não foi "consertado": THC da ONE segue como BL',
  one.linhas.find((l) => l.fee_code === 'THC')?.calculation_unit, 'BL');

// ---------------------------------------------------------------------------
// Mudar a quantidade DENTRO do custeio, a partir da composição unitária.
// É onde uma regra de três sobre o total cobraria BL fee por contêiner.
// ---------------------------------------------------------------------------
console.log('\nRescalar por contêineres (Itapoá · PIL):');
const fx = 5.4;
// Sem arredondar os componentes: é assim que a tela de frete os envia, e é o
// que garante que rescalar para a MESMA quantidade devolva o MESMO número.
const unit = {
  fretePorContainerUsd: 9700,
  taxasPorBlUsd: 620 / fx + 200,          // BRL por BL + USD por BL
  taxasPorContainerUsd: 1370 / fx + 121,  // BRL por ctr + USD por ctr
};
const r1 = rescalarPorContainers(unit, 1);
const r2 = rescalarPorContainers(unit, 2);
const r3 = rescalarPorContainers(unit, 3);

eq('1 contêiner reproduz o cálculo original', r1.taxasLocaisUsd,
  calcularCustoLocal(charges, issues, { pod: 'BRIOA', carrier: 'PIL', containers: 1, usdBrl: fx })!.totalUsd);
eq('2 contêineres reproduzem o cálculo original', r2.taxasLocaisUsd, c.totalUsd);
// O invariante que sustenta o campo do custeio: importar com N contêineres e
// importar com 1 e depois mudar para N precisam dar o MESMO número. Se
// divergirem, o operador vê o valor mudar sozinho ao redigitar a quantidade.
eq('3 contêineres reproduzem o cálculo original', r3.taxasLocaisUsd,
  calcularCustoLocal(charges, issues, { pod: 'BRIOA', carrier: 'PIL', containers: 3, usdBrl: fx })!.totalUsd);
eq('frete escala linearmente', [r1.freteUsd, r2.freteUsd, r3.freteUsd], [9700, 19400, 29100]);
// A regra que esta função protege: se a taxa por BL escalasse, 3 contêineres
// dariam 3x o valor de 1. A diferença é exatamente 2x a parte por BL.
eq('taxa por BL NÃO triplica', r3.taxasLocaisUsd !== r1.taxasLocaisUsd * 3, true);
eq('a diferença entre 3x e 1x é só a parte por contêiner',
  Math.round((r3.taxasLocaisUsd - r1.taxasLocaisUsd) * 100) / 100,
  Math.round(unit.taxasPorContainerUsd * 2 * 100) / 100);
eq('quantidade inválida vira 1', rescalarPorContainers(unit, 0).freteUsd, 9700);

console.log('\nBordas:');
eq('porto sem taxa cadastrada devolve null (≠ custo zero)',
  calcularCustoLocal(charges, issues, { pod: 'CNSHA', carrier: 'PIL', containers: 1, usdBrl: 5.4 }), null);
eq('armador sem taxa naquele porto devolve null',
  calcularCustoLocal(charges, issues, { pod: 'BRIOA', carrier: 'INEXISTENTE', containers: 1, usdBrl: 5.4, incluirAgente: false }), null);
eq('zero contêineres conta como um',
  calcularCustoLocal(charges, issues, { pod: 'BRIOA', carrier: 'PIL', containers: 0, usdBrl: 5.4 })!.containers, 1);

// Todo armador das taxas locais precisa ter código canônico; um alias errado
// (HAPAG em vez de HPL) faria o custo local sumir sem erro nenhum.
console.log('\nCódigos de armador:');
const CANONICOS = new Set(['PIL','CMA','YML','HMM','COSCO','ONE','OOCL','MSK','MSC','EMC','CSSC','HPL']);
const orfaos = [...new Set(charges.filter((x) => x.entity_type === 'CARRIER').map((x) => x.entity_name))]
  .filter((n) => !CANONICOS.has(n));
eq('nenhum armador fora da lista canônica', orfaos, []);

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
