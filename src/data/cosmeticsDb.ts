/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CosmeticNcmInfo {
  ncm: string;
  description: string;
  agency: string;
  chapter: string;
  normativeLink: string;
  mainNormative: string;
  requiresLi: boolean;
  isAntidumpingActive: boolean;
  antidumpingDetails?: string;
  minPriceUsd: number;
}

export const COSMETICS_DATABASE: CosmeticNcmInfo[] = [
  {
    ncm: "3303.00.10",
    description: "Perfumes",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 8.50
  },
  {
    ncm: "3303.00.20",
    description: "Águas de colônia",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 4.20
  },
  {
    ncm: "3304.10.00",
    description: "Produtos de maquiagem para os lábios",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 1.80
  },
  {
    ncm: "3304.20.10",
    description: "Sombras e delineadores",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 2.10
  },
  {
    ncm: "3304.20.90",
    description: "Outros produtos de maquiagem para os olhos",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 2.30
  },
  {
    ncm: "3304.30.00",
    description: "Preparações para manicuros e pedicuros",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 1.50
  },
  {
    ncm: "3304.91.00",
    description: "Pós de beleza",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 2.50
  },
  {
    ncm: "3304.99.10",
    description: "Cremes de beleza / cremes nutritivos / loções tônicas",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 3.50
  },
  {
    ncm: "3304.99.90",
    description: "Outras preparações para cuidados da pele (ex: protetores solares)",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 3.80
  },
  {
    ncm: "3305.10.00",
    description: "Xampus",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 2.20
  },
  {
    ncm: "3305.20.00",
    description: "Preparações para ondulação ou alisamento capilar",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000906&seqAto=000&valorAno=2024",
    mainNormative: "RDC 906/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 4.80
  },
  {
    ncm: "3305.90.00",
    description: "Outros capilares",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 3.10
  },
  {
    ncm: "3306.10.00",
    description: "Preparações para higiene bucal ou dentária",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 1.90
  },
  {
    ncm: "3307.20.00",
    description: "Desodorantes corporais e antiperspirantes",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 2.00
  },
  {
    ncm: "3307.90.00",
    description: "Outros (depilatórios, loções pré e pós-barba)",
    agency: "ANVISA",
    chapter: "Cap. 33",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000907&seqAto=000&valorAno=2024",
    mainNormative: "RDC 907/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 2.50
  },
  {
    ncm: "3401.11.90",
    description: "Sabonetes de toucador",
    agency: "ANVISA",
    chapter: "Cap. 34",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000898&seqAto=000&valorAno=2024",
    mainNormative: "RDC 898/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 0.90
  },
  {
    ncm: "3401.30.00",
    description: "Produtos orgânicos tensoativos para lavar a pele (líquidos/creme)",
    agency: "ANVISA",
    chapter: "Cap. 34",
    normativeLink: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000898&seqAto=000&valorAno=2024",
    mainNormative: "RDC 898/2024",
    requiresLi: true,
    isAntidumpingActive: false,
    minPriceUsd: 1.50
  }
];

export function getCosmeticByNcm(ncm: string): CosmeticNcmInfo | undefined {
  const cleanNcm = ncm.replace(/[^0-9]/g, "");
  return COSMETICS_DATABASE.find(item => {
    const cleanDb = item.ncm.replace(/[^0-9]/g, "");
    return cleanNcm.startsWith(cleanDb) || cleanDb.startsWith(cleanNcm);
  });
}

export function searchCosmetics(query: string): CosmeticNcmInfo[] {
  if (!query) return [];
  const lower = query.toLowerCase();
  return COSMETICS_DATABASE.filter(item => 
    item.ncm.includes(lower) || 
    item.description.toLowerCase().includes(lower) ||
    item.mainNormative.toLowerCase().includes(lower)
  );
}
