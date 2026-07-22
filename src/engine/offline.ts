/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fallback CLIENT-SIDE para quando os endpoints do backend não estão disponíveis
 * (ex.: deploy estático na Vercel sem o servidor Express). Os dados aqui são os
 * MESMOS dados reais do piloto (subconjunto cosmético + fases IBS/CBS + ementas),
 * embutidos para o motor puro `computeCosting` rodar no navegador.
 */
import { CostingRates, ReformaRegra } from './costing';

const digits = (s: string) => (s || '').replace(/[^0-9]/g, '');

// Tributos federais reais (aba `tax` do tax_calc) — cap. 33. Default = perfil cosmético.
const TRIB: Record<string, { ii: number; ipi: number; pis: number; cofins: number }> = {
  '33049990': { ii: 18, ipi: 14.3, pis: 2.1, cofins: 9.65 },
  '33049910': { ii: 18, ipi: 14.3, pis: 2.1, cofins: 9.65 },
  '33030010': { ii: 18, ipi: 27.3, pis: 2.1, cofins: 9.65 },
  '33030020': { ii: 18, ipi: 7.8, pis: 2.1, cofins: 9.65 },
  '33051000': { ii: 18, ipi: 4.55, pis: 2.1, cofins: 9.65 },
  '96170010': { ii: 16, ipi: 0, pis: 2.1, cofins: 9.65 },
  '39073022': { ii: 14, ipi: 0, pis: 2.1, cofins: 9.65 },
};
const TRIB_DEFAULT = { ii: 18, ipi: 14.3, pis: 2.1, cofins: 9.65 };

// ICMS por UF (aba `icms`).
const ICMS: Record<string, number> = { SP: 18, PR: 19, SC: 17, RJ: 20, MG: 19, ES: 17 };

// Fases IBS/CBS (0001_static + 0003_ibs_cbs_fases). Percentuais 2027+ são provisórios.
function faseLocal(date: string): ReformaRegra {
  const y = parseInt(date.slice(0, 4), 10) || 2026;
  if (y <= 2026) return { cbsPct: 0.9, ibsPct: 0.1, cbsCompensavel: true, ibsCompensavel: true, pisCofinsAtivo: true, ipiZerado: false, baseLegal: 'LC 214/2025 art. 348, I' };
  if (y <= 2028) return { cbsPct: 8.8, ibsPct: 0.1, cbsCompensavel: false, ibsCompensavel: false, pisCofinsAtivo: false, ipiZerado: true, baseLegal: 'PROVISÓRIO — CBS cheia; PIS/COFINS extintos; IPI zerado' };
  if (y <= 2032) return { cbsPct: 8.8, ibsPct: 8.85, cbsCompensavel: false, ibsCompensavel: false, pisCofinsAtivo: false, ipiZerado: true, baseLegal: 'PROVISÓRIO — transição ICMS/IBS' };
  return { cbsPct: 8.8, ibsPct: 17.7, cbsCompensavel: false, ibsCompensavel: false, pisCofinsAtivo: false, ipiZerado: true, baseLegal: 'PROVISÓRIO — regime definitivo' };
}

export function resolveRatesLocal(ncm: string, uf: string, dataFatoGerador: string): CostingRates {
  const t = TRIB[digits(ncm)] ?? TRIB_DEFAULT;
  return {
    iiPct: t.ii, ipiPct: t.ipi, pisPct: t.pis, cofinsPct: t.cofins,
    icmsPct: ICMS[uf?.toUpperCase()] ?? 18,
    afrmmPct: 25, siscomexTotal: 154.23,
    reforma: faseLocal(dataFatoGerador),
  };
}

// Ementas reais (mcat.norma) para citação offline.
export const NORMA_LOCAL: Record<string, { tipo: string; orgao_emissor: string; ementa: string }> = {
  'LC 214/2025': { tipo: 'Lei Complementar', orgao_emissor: 'Congresso Nacional', ementa: 'Institui o IBS, a CBS e o Imposto Seletivo' },
  'Decreto 12.955/2026': { tipo: 'Decreto', orgao_emissor: 'Executivo', ementa: 'Regulamenta a CBS (base de cálculo, art. 13)' },
  'RDC 907/2024': { tipo: 'RDC', orgao_emissor: 'ANVISA', ementa: 'Definição, classificação, rotulagem e regularização de cosméticos, higiene pessoal e perfumes' },
  'RDC 752/2022': { tipo: 'RDC', orgao_emissor: 'ANVISA', ementa: 'Norma-base de cosméticos (definição e classificação)' },
  'RDC 16/2014': { tipo: 'RDC', orgao_emissor: 'ANVISA', ementa: 'Autorização de Funcionamento de Empresa (AFE)' },
  'RDC 949/2024': { tipo: 'RDC', orgao_emissor: 'ANVISA', ementa: 'Cosméticos Grau 1 e Grau 2' },
};

export function normaLocal(ref: string) {
  const key = Object.keys(NORMA_LOCAL).find((k) => ref.includes(k) || k.includes(ref));
  return key ? { identificacao: key, ...NORMA_LOCAL[key] } : null;
}
