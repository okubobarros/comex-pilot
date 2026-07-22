/**
 * Teste do motor de custeio (src/engine/costing.ts). Roda com: npx tsx scripts/test_costing.ts
 * Confere a matemática contra valores calculados à mão e as invariantes da Reforma.
 */
import { computeCosting, CostingRates, REGRA_2026 } from '../src/engine/costing';

let falhas = 0;
const eq = (nome: string, got: number, exp: number, tol = 0.01) => {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) falhas++;
  console.log(`  ${ok ? 'OK ' : 'FAIL'}  ${nome}: got=${got} exp=${exp}`);
};

// ---- Caso A: cosmético 3304.99.90, 2026, FOB 10k, câmbio 5.00, ICMS 18% (SP), 1 adição ----
console.log('Caso A — cosmético 3304.99.90 @ 2026 (as-is):');
const ratesA: CostingRates = {
  iiPct: 18, ipiPct: 14.3, pisPct: 2.1, cofinsPct: 9.65,
  icmsPct: 18, afrmmPct: 0, siscomexTotal: 154.23, reforma: REGRA_2026,
};
const a = computeCosting({ fobUsd: 10000, freightUsd: 0, insuranceUsd: 0, usdBrl: 5.0 }, ratesA);
console.table(a);
eq('vmld', a.vmld, 50000);
eq('ii', a.ii, 9000);
eq('ipi', a.ipi, 8437);
eq('pis', a.pis, 1050);
eq('cofins', a.cofins, 4825);
eq('icms', a.icms, 16126.73);
eq('ctiAsIs', a.ctiAsIs, 89592.96);
eq('cbsDeclarar (0,9%)', a.cbsDeclarar, 450);
eq('ibsDeclarar (0,1%)', a.ibsDeclarar, 50);
eq('impactoCaixaNovos (compensável→0)', a.impactoCaixaNovos, 0);
eq('ctiToBe == ctiAsIs em 2026', a.ctiToBe, a.ctiAsIs);

// ---- Caso B: fase 2027 sintética — PIS/COFINS extintos, IPI zerado, CBS não compensável ----
console.log('\nCaso B — fase 2027 (regra muda desembolso):');
const ratesB: CostingRates = {
  ...ratesA,
  reforma: {
    cbsPct: 8.8, ibsPct: 1.0, cbsCompensavel: false, ibsCompensavel: false,
    pisCofinsAtivo: false, ipiZerado: true, baseLegal: 'sintético 2027',
  },
};
const b = computeCosting({ fobUsd: 10000, freightUsd: 0, insuranceUsd: 0, usdBrl: 5.0 }, ratesB);
console.table(b);
eq('pis zerado', b.pis, 0);
eq('cofins zerado', b.cofins, 0);
eq('ipi zerado', b.ipi, 0);
eq('cbsDeclarar (8,8% de 50000)', b.cbsDeclarar, 4400);
eq('ibsDeclarar (1,0% de 50000)', b.ibsDeclarar, 500);
eq('impactoCaixaNovos (não compensável)', b.impactoCaixaNovos, 4900);
eq('ctiToBe = ctiAsIs + 4900', b.ctiToBe, b.ctiAsIs + 4900);

// ---- Caso C: com frete → AFRMM incide ----
console.log('\nCaso C — com frete marítimo (AFRMM 25%):');
const ratesC: CostingRates = { ...ratesA, afrmmPct: 25 };
const c = computeCosting({ fobUsd: 10000, freightUsd: 1000, insuranceUsd: 0, usdBrl: 5.0 }, ratesC);
eq('afrmm (25% de frete 1000*5)', c.afrmm, 1250);

console.log(`\n${falhas === 0 ? '✅ TODOS OS TESTES PASSARAM' : `❌ ${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
