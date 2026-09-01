/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regras NCM do piloto — a base de referência que o motor de alertas cruza com
 * os itens da fatura (preço mínimo, antidumping, anuência, ex-tarifário).
 *
 * Este arquivo saiu de `mockScenarios.ts`, que também guardava auditorias
 * pré-fabricadas. Os cenários foram removidos: eram resultados montados à mão,
 * exibidos como se tivessem sido calculados. As regras abaixo, não — são
 * parâmetros normativos aplicados de verdade em cada análise.
 */

import { NcmRule } from '../types';

export const DEFAULT_NCM_RULES: NcmRule[] = [
  {
    ncm: '3304.99.90',
    description: 'Cosméticos, produtos de beleza ou de maquilagem e preparações para conservação da pele',
    minReferencePrice: 3.50,
    isAntidumpingActive: false,
    requiresAnvisa: true,
    checkMapaConflict: true,
    requiresAnatel: false,
    requiresInmetro: false,
    hasExTarifario: false,
    standardIiRate: 18,
    hasPisCofinsZeroOpportunity: false
  },
  {
    ncm: '9617.00.10',
    description: 'Garrafas térmicas e outros recipientes isotérmicos montados, com vácuo',
    minReferencePrice: 9.50,
    isAntidumpingActive: true,
    antidumpingFeeKgUsd: 4.10,
    antidumpingOrigin: 'China',
    requiresAnvisa: false,
    checkMapaConflict: false,
    requiresAnatel: false,
    requiresInmetro: false,
    hasExTarifario: false,
    standardIiRate: 16,
    hasPisCofinsZeroOpportunity: false
  },
  {
    ncm: '3907.30.22',
    description: 'Resinas epóxidas em formas primárias para fabricação de tintas industriais',
    minReferencePrice: 5.50,
    isAntidumpingActive: false,
    requiresAnvisa: false,
    checkMapaConflict: false,
    requiresAnatel: false,
    requiresInmetro: false,
    hasExTarifario: true,
    exTarifarioRate: 0,
    standardIiRate: 14,
    hasPisCofinsZeroOpportunity: true,
    pisCofinsZeroBasis: 'Lei nº 10.865/2004, Art. 8º, § 11 - Destinação específica para fabricação de tintas protetivas industriais ou marítimas'
  },
  {
    ncm: '8806.92.00',
    description: 'Aeronaves não tripuladas (drones) com peso vazio superior a 250g mas não superior a 7kg',
    minReferencePrice: 400.00,
    isAntidumpingActive: false,
    requiresAnvisa: false,
    checkMapaConflict: false,
    requiresAnatel: true,
    requiresInmetro: false,
    hasExTarifario: false,
    standardIiRate: 12,
    hasPisCofinsZeroOpportunity: false
  },
  {
    ncm: '8517.62.77',
    description: 'Outros aparelhos transmissores com receptor incorporado, de tecnologia sem fio (Wi-Fi, Bluetooth)',
    minReferencePrice: 20.00,
    isAntidumpingActive: false,
    requiresAnvisa: false,
    checkMapaConflict: false,
    requiresAnatel: true,
    requiresInmetro: false,
    hasExTarifario: false,
    standardIiRate: 10,
    hasPisCofinsZeroOpportunity: false
  }
];
