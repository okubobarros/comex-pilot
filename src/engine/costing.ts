/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de custeio de importação — função PURA e versionada por data do fato gerador.
 *
 * Modelo as-is (bem estabelecido):
 *   VMLD → II → IPI → PIS → COFINS → AFRMM → Taxa Siscomex → ICMS ("por dentro") → CTI
 *
 * Modelo to-be (Reforma Tributária): soma CBS/IBS conforme a regra vigente na data
 * (LC 214/2025). Em 2026 os dois são compensáveis (impacto de caixa zero). A partir de
 * 2027 a regra muda (PIS/COFINS extintos, IPI zerado etc.) — tudo vem de `rates.reforma`,
 * não de `if` no código.
 *
 * ⚠️ Base de cálculo de CBS/IBS: usamos VMLD (valor aduaneiro) como base v1. O Decreto
 * 12.955/2026 art. 13 detalha a composição (inclui frete/seguro/tributos/taxas; exclui
 * CBS/IBS e IPI) — a composição exata está pendente de validação com o tributarista
 * (ver docs/architecture/costing-engine.md e docs/data/data-acquisition-checklist.md §3.4).
 * Por isso `baseIbsCbs` é exposto no resultado, para auditoria.
 */

export type Modal = 'longo_curso' | 'cabotagem' | 'fluvial_lacustre_granel_nne' | 'aereo' | 'outro';

/** Regra IBS/CBS vigente na data (linha de `mcat.ibs_cbs_regra`). */
export interface ReformaRegra {
  cbsPct: number;          // ex.: 0.9
  ibsPct: number;          // ex.: 0.1
  cbsCompensavel: boolean; // 2026: true (compensa com PIS/COFINS → não impacta caixa)
  ibsCompensavel: boolean;
  pisCofinsAtivo: boolean; // 2027: false
  ipiZerado: boolean;      // 2027: true (exceto ZFM)
  baseLegal?: string;
}

/** Alíquotas resolvidas para (NCM, UF, data). Vêm das tabelas `mcat.*`. */
export interface CostingRates {
  iiPct: number;           // % II (ex.: 18)
  ipiPct: number;          // % IPI
  pisPct: number;          // % PIS-Importação
  cofinsPct: number;       // % COFINS-Importação
  icmsPct: number;         // % ICMS da UF de destino
  afrmmPct: number;        // % AFRMM do modal (0 se não marítimo)
  siscomexTotal: number;   // R$ taxa Siscomex total (por nº de adições)
  reforma: ReformaRegra;
}

export interface CostingInput {
  fobUsd: number;
  freightUsd: number;      // frete internacional
  insuranceUsd: number;    // seguro internacional
  usdBrl: number;          // câmbio da data (PTAX)
  /** Despesas aduaneiras em BRL (capatazia/THC, armazenagem, honorários...). Opcional. */
  outrasDespesasBrl?: number;
}

export interface CostingResult {
  vmld: number;            // valor aduaneiro (CIF) em BRL
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
  afrmm: number;
  siscomex: number;
  icms: number;
  baseIcms: number;
  /** CTI (desembolso real) do modelo atual. */
  ctiAsIs: number;
  // Reforma
  baseIbsCbs: number;
  cbsDeclarar: number;
  ibsDeclarar: number;
  /** Quanto do CBS/IBS efetivamente sai do caixa (0 quando compensável). */
  impactoCaixaNovos: number;
  /** CTI considerando a regra vigente (2026 ≈ as-is; 2027+ muda). */
  ctiToBe: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Calcula o custo de importação. Determinístico: mesma entrada → mesma saída.
 * Não faz I/O — as alíquotas já vêm resolvidas em `rates` (versionadas por data).
 */
export function computeCosting(input: CostingInput, rates: CostingRates): CostingResult {
  const { reforma } = rates;
  const despesas = input.outrasDespesasBrl ?? 0;

  // Valor aduaneiro (CIF) em BRL
  const cifUsd = input.fobUsd + input.freightUsd + input.insuranceUsd;
  const vmld = cifUsd * input.usdBrl;

  // Tributos federais (as-is). Na fase to-be, a regra pode zerar PIS/COFINS e IPI.
  const ii = vmld * (rates.iiPct / 100);
  const ipiAtivo = !reforma.ipiZerado;
  const ipi = ipiAtivo ? (vmld + ii) * (rates.ipiPct / 100) : 0;
  const pis = reforma.pisCofinsAtivo ? vmld * (rates.pisPct / 100) : 0;
  const cofins = reforma.pisCofinsAtivo ? vmld * (rates.cofinsPct / 100) : 0;

  // AFRMM incide sobre o frete internacional (convertido), conforme modal.
  const freteBrl = input.freightUsd * input.usdBrl;
  const afrmm = freteBrl * (rates.afrmmPct / 100);

  const siscomex = rates.siscomexTotal;

  // ICMS "por dentro": base inclui os demais tributos e despesas aduaneiras.
  const baseAntesIcms = vmld + ii + ipi + pis + cofins + afrmm + siscomex + despesas;
  const icmsFrac = rates.icmsPct / 100;
  const baseIcms = icmsFrac < 1 ? baseAntesIcms / (1 - icmsFrac) : baseAntesIcms;
  const icms = baseIcms * icmsFrac;

  const ctiAsIs = vmld + ii + ipi + pis + cofins + afrmm + siscomex + icms + despesas;

  // ---- Reforma Tributária (CBS/IBS) ----
  // Base v1 = VMLD (ver aviso no cabeçalho; exposta para auditoria).
  const baseIbsCbs = vmld;
  const cbsDeclarar = baseIbsCbs * (reforma.cbsPct / 100);
  const ibsDeclarar = baseIbsCbs * (reforma.ibsPct / 100);
  const impactoCaixaNovos =
    (reforma.cbsCompensavel ? 0 : cbsDeclarar) + (reforma.ibsCompensavel ? 0 : ibsDeclarar);

  const ctiToBe = ctiAsIs + impactoCaixaNovos;

  return {
    vmld: round2(vmld),
    ii: round2(ii),
    ipi: round2(ipi),
    pis: round2(pis),
    cofins: round2(cofins),
    afrmm: round2(afrmm),
    siscomex: round2(siscomex),
    icms: round2(icms),
    baseIcms: round2(baseIcms),
    ctiAsIs: round2(ctiAsIs),
    baseIbsCbs: round2(baseIbsCbs),
    cbsDeclarar: round2(cbsDeclarar),
    ibsDeclarar: round2(ibsDeclarar),
    impactoCaixaNovos: round2(impactoCaixaNovos),
    ctiToBe: round2(ctiToBe),
  };
}

/** Regra IBS/CBS de 2026 (semeada em mcat.ibs_cbs_regra) — atalho para testes/mock. */
export const REGRA_2026: ReformaRegra = {
  cbsPct: 0.9,
  ibsPct: 0.1,
  cbsCompensavel: true,
  ibsCompensavel: true,
  pisCofinsAtivo: true,
  ipiZerado: false,
  baseLegal: 'LC 214/2025 art. 348, I',
};
