/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Classificador de NCM de tiro rápido para o chat (intenção "Classificar NCM").
 * Casa a descrição livre / linha de fatura com a NCM provável e cita a fonte
 * regulatória. Determinístico — não depende do backend Gemini para responder.
 */

import { ClassificationResult } from '../types';
import { COSMETICS_DATABASE } from '../data/cosmeticsDb';

interface ClassRule {
  test: RegExp;
  ncm: string;
  description: string;
  agency: string;
  normative: string;
  justification: string;
  referencePriceUsd?: number;
}

// Regras gerais fora do capítulo de cosméticos
const GENERAL_RULES: ClassRule[] = [
  {
    test: /tumbler|mug|garrafa\s*t[eé]rmica|vacuum|isot[eé]rmic|stanley|copo\s*t[eé]rmico/i,
    ncm: '9617.00.10',
    description: 'Garrafas térmicas e outros recipientes isotérmicos montados, com vácuo',
    agency: 'RFB / GECEX',
    normative: 'Resolução GECEX nº 227/2021',
    justification: 'Recipientes isotérmicos de aço inox com vácuo. Se a origem for a China, há incidência de direito antidumping compulsório (USD 4,10/kg líquido) — verifique a origem antes de fechar o custo.',
    referencePriceUsd: 9.5
  },
  {
    test: /resin|resina|ep[oó]xi|epoxy|epoxide/i,
    ncm: '3907.30.22',
    description: 'Resinas epóxidas em formas primárias para fabricação de tintas industriais',
    agency: 'RFB',
    normative: 'Ex-Tarifário ativo + Lei nº 10.865/2004, Art. 8º §11',
    justification: 'Insumo industrial com oportunidade tributária: Ex-Tarifário pode zerar o II e há desoneração de PIS/COFINS quando destinado à fabricação de tintas protetivas. Exige laudo de destinação.',
    referencePriceUsd: 5.5
  },
  {
    test: /drone|quadcopter|uav|aeronave\s*n[aã]o\s*tripulada|vant/i,
    ncm: '8806.92.00',
    description: 'Aeronaves não tripuladas (drones) de peso vazio entre 250g e 7kg',
    agency: 'ANATEL / ANAC',
    normative: 'Resolução ANATEL nº 715/2019 e RBAC-E nº 94 (ANAC)',
    justification: 'Drone comercial: exige homologação ANATEL do transmissor de rádio e cadastro no SISANT da ANAC antes do desembaraço.',
    referencePriceUsd: 400
  },
  {
    test: /wi-?fi|bluetooth|transceiver|m[oó]dulo\s*r[aá]dio|rf\s*module|transmissor/i,
    ncm: '8517.62.77',
    description: 'Aparelhos transmissores com receptor incorporado, de tecnologia sem fio',
    agency: 'ANATEL',
    normative: 'Lei nº 9.472/1997 (LGT) e Resolução ANATEL nº 715/2019',
    justification: 'Emissor de radiofrequência: requer certificado de homologação ANATEL ativo antes da liberação aduaneira.',
    referencePriceUsd: 20
  }
];

// Palavras-chave que apontam para famílias específicas do Capítulo 33/34 (cosméticos)
const COSMETIC_KEYWORDS: { test: RegExp; ncm: string }[] = [
  { test: /protetor\s*solar|sunscreen|spf|hidratante|moisturizer|s[eé]rum|aloe|creme\s*facial|facial\s*gel|skin\s*care/i, ncm: '3304.99.90' },
  { test: /creme\s*(de\s*beleza|nutritivo)|loç[aã]o\s*t[oô]nica|night\s*cream|anti-?idade|anti-?aging/i, ncm: '3304.99.10' },
  { test: /batom|lip\s*(stick|gloss|balm)|l[aá]bios/i, ncm: '3304.10.00' },
  { test: /sombra|delineador|eyeliner|eyeshadow|maquiagem\s*(para\s*)?olhos/i, ncm: '3304.20.10' },
  { test: /perfume|eau\s*de\s*parfum|fragr[aâ]ncia|fragrance/i, ncm: '3303.00.10' },
  { test: /colonia|col[oô]nia|eau\s*de\s*cologne/i, ncm: '3303.00.20' },
  { test: /xampu|shampoo/i, ncm: '3305.10.00' },
  { test: /condicionador|alisamento|ondula[cç][aã]o|relaxer/i, ncm: '3305.20.00' },
  { test: /creme\s*dental|toothpaste|higiene\s*bucal|enxaguante/i, ncm: '3306.10.00' },
  { test: /desodorante|deodorant|antiperspir/i, ncm: '3307.20.00' },
  { test: /sabonete|soap|toucador/i, ncm: '3401.11.90' },
  { test: /p[oó]\s*(de\s*)?beleza|face\s*powder|blush/i, ncm: '3304.91.00' }
];

const cleanDigits = (s: string) => s.replace(/[^0-9]/g, '');

/**
 * Classifica um produto a partir de texto livre / descrição / linha de fatura.
 * Ordem: NCM explícita no texto → regras gerais → palavras-chave de cosméticos → fallback.
 */
export function classifyProduct(query: string): ClassificationResult {
  const text = (query || '').trim();

  // 1. NCM digitada explicitamente (ex.: "3304.99.90" ou "33049990")
  const ncmMatch = text.match(/\b\d{4}\.?\d{2}\.?\d{2}\b/);
  if (ncmMatch) {
    const cosmetic = COSMETICS_DATABASE.find(c => cleanDigits(c.ncm) === cleanDigits(ncmMatch[0]));
    if (cosmetic) {
      return {
        ncm: cosmetic.ncm,
        officialDescription: cosmetic.description,
        agency: cosmetic.agency,
        normative: cosmetic.mainNormative,
        justification: `Produto do ${cosmetic.chapter} sob controle sanitário da ANVISA. Exige Licença de Importação (LI) deferida antes do embarque.`,
        referencePriceUsd: cosmetic.minPriceUsd,
        confidence: 'alta'
      };
    }
  }

  // 2. Regras gerais (não-cosméticos)
  const general = GENERAL_RULES.find(r => r.test.test(text));
  if (general) {
    return {
      ncm: general.ncm,
      officialDescription: general.description,
      agency: general.agency,
      normative: general.normative,
      justification: general.justification,
      referencePriceUsd: general.referencePriceUsd,
      confidence: 'alta'
    };
  }

  // 3. Palavras-chave de cosméticos
  const cosmeticHit = COSMETIC_KEYWORDS.find(k => k.test.test(text));
  if (cosmeticHit) {
    const info = COSMETICS_DATABASE.find(c => c.ncm === cosmeticHit.ncm);
    if (info) {
      const organic = /organic|org[aâ]nic|aloe|vegetal|natural|extrato/i.test(text);
      return {
        ncm: info.ncm,
        officialDescription: info.description,
        agency: info.agency,
        normative: info.mainNormative,
        justification: `Produto do ${info.chapter} sob controle da ANVISA — exige LI pré-embarque (${info.mainNormative}).${organic ? ' Apelo vegetal/orgânico detectado: risco de dupla anuência ANVISA + MAPA (IN Conjunta 01/2012).' : ''}`,
        referencePriceUsd: info.minPriceUsd,
        confidence: organic ? 'alta' : 'média'
      };
    }
  }

  // 4. Fallback: cosmético genérico do Cap. 33
  const fallback = COSMETICS_DATABASE.find(c => c.ncm === '3304.99.90')!;
  return {
    ncm: fallback.ncm,
    officialDescription: fallback.description,
    agency: fallback.agency,
    normative: fallback.mainNormative,
    justification: 'Não identifiquei uma correspondência forte. Sugestão preliminar para preparações de cuidados da pele — envie mais detalhes (material, uso, composição) para refinar a classificação.',
    referencePriceUsd: fallback.minPriceUsd,
    confidence: 'baixa'
  };
}

/** Formata o resultado de classificação como mensagem markdown para o feed do chat. */
export function formatClassification(result: ClassificationResult, sourceLabel?: string): string {
  const confBadge = { alta: '🟢 Alta', 'média': '🟡 Média', baixa: '🔴 Baixa' }[result.confidence];
  const priceLine = result.referencePriceUsd
    ? `\n**Preço de referência (valoração):** USD ${result.referencePriceUsd.toFixed(2)} / un`
    : '';
  return `${sourceLabel ? sourceLabel + '\n\n' : ''}**NCM sugerida:** \`${result.ncm}\`\n**Descrição oficial:** ${result.officialDescription}\n**Órgão anuente:** ${result.agency} · ${result.normative}${priceLine}\n\n**Justificativa regulatória:** ${result.justification}\n\n_Confiança da classificação: ${confBadge}_`;
}
