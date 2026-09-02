/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Faturas de exemplo — texto de ENTRADA, nunca resultado.
 *
 * Cada exemplo é só o texto de uma invoice plausível. Ao acionar um deles, a
 * esteira real roda inteira: extração dos itens e depois o motor de regras.
 * O veredito é calculado na hora, como seria com o documento do cliente.
 * (Antes existiam auditorias pré-fabricadas; foram removidas porque exibiam um
 * resultado que ninguém computou.)
 *
 * Os NCMs escolhidos têm regra correspondente em `ncmRules.ts`, então o exemplo
 * exercita um alerta de verdade em vez de passar batido:
 *   3304.99.90 → anuência ANVISA e conflito de competência com o MAPA
 *   8517.62.77 → homologação ANATEL (equipamento de radiocomunicação)
 *   9617.00.10 → direito antidumping ativo sobre origem China
 *   3907.30.22 → ex-tarifário e desoneração de PIS/COFINS por finalidade
 */

const QUEBRA = '\n';

export interface ExemploInvoice {
  /** Rótulo curto para o botão. */
  label: string;
  /** O que este exemplo exercita — mostrado como legenda no card. */
  hint: string;
  texto: string;
}

export const EXEMPLOS_INVOICE: ExemploInvoice[] = [
  {
    label: 'Invoice de cosméticos (Coreia)',
    hint: 'Anuência ANVISA',
    texto: [
      'COMMERCIAL INVOICE — SEOUL BEAUTY CO. LTD (KR)',
      '1. Hydrating facial cream, NCM 3304.99.90, 5.000 un x USD 2.10, origin: South Korea',
      '2. Aloe vera gel 300ml, NCM 3304.99.90, 3.000 un x USD 1.40, origin: South Korea',
      'Incoterm: FOB Busan · Total FOB USD 14.700',
    ].join(QUEBRA),
  },
  {
    label: 'Invoice de eletrônicos (China)',
    hint: 'Homologação ANATEL',
    texto: [
      'COMMERCIAL INVOICE — SHENZHEN LINKTECH ELECTRONICS CO. LTD',
      '1. Wireless router dual-band 2.4/5GHz, NCM 8517.62.77, 2.000 un x USD 18.40, origin: China',
      '2. Bluetooth audio receiver module, NCM 8517.62.77, 6.000 un x USD 4.90, origin: China',
      'Incoterm: FOB Shenzhen · Total FOB USD 66.200',
    ].join(QUEBRA),
  },
  {
    label: 'Invoice de garrafas térmicas (China)',
    hint: 'Antidumping ativo',
    texto: [
      'COMMERCIAL INVOICE — NINGBO HOMEWARE TRADING CO.',
      '1. Stainless steel vacuum tumbler 900ml, NCM 9617.00.10, 5.000 un x USD 3.80, origin: China',
      'Incoterm: FOB Ningbo · Total FOB USD 19.000',
    ].join(QUEBRA),
  },
  {
    label: 'Invoice de resina epóxi (EUA)',
    hint: 'Ex-tarifário e PIS/COFINS',
    texto: [
      'COMMERCIAL INVOICE — MIDWEST POLYMERS INC (US)',
      '1. Epoxy resin, industrial grade, NCM 3907.30.11, 18.000 kg x USD 2.50, origin: USA',
      'Incoterm: CFR Santos · Total USD 45.000',
    ].join(QUEBRA),
  },
];
