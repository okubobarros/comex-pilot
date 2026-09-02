/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Alíquotas de importação por NCM — e, principalmente, o que NÃO temos.
 *
 * POR QUE ESTE ARQUIVO É TÃO CAUTELOSO
 * ------------------------------------
 * Uma tela de classificação pede naturalmente "a tabela tributária completa".
 * Só que este repositório não carrega a TEC nem a TIPI: não existe alíquota de
 * II e de IPI por NCM aqui. Preencher esses campos com um número plausível
 * seria pior do que deixá-los vazios — quem monta um custeio em cima de um IPI
 * inventado erra o preço de venda e descobre no desembaraço.
 *
 * Então cada linha declara sua origem, e a ausência de fonte é exibida como
 * ausência, com o caminho para obter o dado. O cálculo de verdade acontece no
 * Custo de Importação, onde as alíquotas são informadas por quem opera.
 *
 * O QUE É SUSTENTÁVEL AFIRMAR
 * ---------------------------
 *  - PIS/COFINS-Importação sobre bens, regime geral: 2,10% e 9,65%
 *    (Lei 10.865/2004, art. 8º, § 9º, na redação da Lei 13.137/2015).
 *    São alíquotas gerais, não por NCM — mas o próprio art. 8º traz listas
 *    específicas (§§ 1º a 21) com alíquotas majoradas ou reduzidas, e por isso
 *    a linha vem marcada como regime geral, a confirmar.
 *  - II: apenas para os NCMs com regra curada em `ncmRules.ts`, que é a mesma
 *    referência usada pelo motor de alertas. Fora dessa lista, não afirmamos.
 *  - IPI: nenhum. Depende da TIPI e não há tabela carregada.
 */

import { DEFAULT_NCM_RULES } from './ncmRules';

export interface AliquotaTributo {
  sigla: 'II' | 'IPI' | 'PIS' | 'COFINS';
  nome: string;
  /** Percentual, ou null quando não há fonte para este NCM nesta base. */
  pct: number | null;
  /** De onde veio o número — ou onde obtê-lo, quando não veio. */
  fonte: string;
  /** Ressalva que muda a leitura do número. */
  ressalva?: string;
}

const digitos = (s: string) => String(s ?? '').replace(/\D/g, '');

/** Alíquota geral de PIS/COFINS-Importação sobre bens. */
export const PIS_IMPORTACAO_GERAL = 2.1;
export const COFINS_IMPORTACAO_GERAL = 9.65;

export const FONTE_TEC = 'https://www.gov.br/siscomex/pt-br/informacoes/tarifa-externa-comum-tec';
export const FONTE_TIPI = 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/ipi';

/**
 * Alíquotas conhecidas para um NCM. Sempre devolve as quatro linhas: a que não
 * tem fonte aparece com `pct: null` e diz onde consultar, em vez de sumir da
 * tabela como se o tributo não incidisse.
 */
export function tributosPara(ncm: string): AliquotaTributo[] {
  const codigo = digitos(ncm);
  const regra = DEFAULT_NCM_RULES.find((r) => digitos(r.ncm) === codigo);

  return [
    {
      sigla: 'II',
      nome: 'Imposto de Importação',
      pct: regra?.standardIiRate ?? null,
      fonte: regra
        ? 'Base de referência do ComexPilot para este NCM'
        : 'TEC — Tarifa Externa Comum (não carregada nesta base)',
      ressalva: regra?.hasExTarifario
        ? `Ex-tarifário vigente reduz a ${regra.exTarifarioRate ?? 0}% para a destinação prevista.`
        : undefined,
    },
    {
      sigla: 'IPI',
      nome: 'Imposto sobre Produtos Industrializados',
      pct: null,
      fonte: 'TIPI — Decreto 11.158/2022 (não carregada nesta base)',
    },
    {
      sigla: 'PIS',
      nome: 'PIS/PASEP-Importação',
      pct: PIS_IMPORTACAO_GERAL,
      fonte: 'Lei 10.865/2004, art. 8º, § 9º (redação da Lei 13.137/2015)',
      ressalva: 'Alíquota do regime geral sobre bens. O art. 8º traz listas com alíquota própria — confirme se este NCM está em alguma.',
    },
    {
      sigla: 'COFINS',
      nome: 'COFINS-Importação',
      pct: COFINS_IMPORTACAO_GERAL,
      fonte: 'Lei 10.865/2004, art. 8º, § 9º (redação da Lei 13.137/2015)',
      ressalva: regra?.hasPisCofinsZeroOpportunity
        ? `Possível redução a zero: ${regra.pisCofinsZeroBasis ?? 'verificar destinação'}`
        : 'Alíquota do regime geral sobre bens. Adicional de 1% do art. 8º, § 21, quando aplicável ao NCM.',
    },
  ];
}
