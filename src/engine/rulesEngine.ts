/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditAlert, InvoiceAnalysis, InvoiceItem, NcmRule } from '../types';

const USD_BRL = 5.5;

const cleanNcm = (ncm: string) => (ncm || '').replace(/[^0-9]/g, '');

export function findRuleForNcm(ncm: string, rules: NcmRule[]): NcmRule | undefined {
  const target = cleanNcm(ncm);
  if (!target) return undefined;
  return rules.find(r => {
    const ruleNcm = cleanNcm(r.ncm);
    return target.startsWith(ruleNcm) || ruleNcm.startsWith(target);
  });
}

/**
 * Núcleo de auditoria: cruza os itens da Invoice com as regras NCM e
 * devolve os alertas derivados + score de risco. Toda análise exibida
 * na interface passa por aqui — nenhum alerta é lido pronto de mock.
 */
export function computeAlerts(items: InvoiceItem[], rules: NcmRule[]): { alerts: AuditAlert[]; riskScore: number } {
  const alerts: AuditAlert[] = [];
  let alertIdCounter = 9000;

  items.forEach((item) => {
    const rule = findRuleForNcm(item.ncm, rules);
    if (!rule) return;

    const currency = item.currency || 'USD';
    const unitPrice = Number(item.unitPrice) || 0;
    const quantity = Number(item.quantity) || 1;
    const totalItemPrice = unitPrice * quantity;
    const descLower = item.description.toLowerCase();

    // 1. RED - Subfaturamento (Canal Cinza)
    if (unitPrice < rule.minReferencePrice) {
      const diffUsd = (rule.minReferencePrice - unitPrice) * quantity;
      alerts.push({
        id: `alt-eng-${alertIdCounter++}`,
        severity: 'red',
        title: `Risco de Subfaturamento (Canal Cinza) - NCM ${rule.ncm}`,
        description: `O preço unitário de ${currency} ${unitPrice.toFixed(2)} para "${item.description}" está abaixo do preço de referência aduaneiro de ${currency} ${rule.minReferencePrice.toFixed(2)}.`,
        baseLegal: 'Instrução Normativa RFB nº 1986/2020 (Procedimento Especial de Fiscalização de Combate à Fraude Aduaneira) e Art. 86 da MP nº 2.158-35/2001.',
        impactoFinanceiro: `Instauração de canal cinza com retenção da carga por até 90 dias para valoração. Risco de arbitramento tributário e multa punitiva de 100% sobre a diferença de valor calculada em USD ${diffUsd.toFixed(2)} (aprox. R$ ${(diffUsd * USD_BRL).toFixed(2)}).`,
        planoAcao: "Obter com urgência o 'Cost Breakdown' original do fabricante, comprovante Swift de remessa financeira total e a Declaração de Exportação (D.E.) do país de origem.",
        affectedItems: [item.description]
      });
    }

    // 2. RED - Antidumping
    if (rule.isAntidumpingActive && (item.countryOfOrigin || '').toLowerCase().includes('china')) {
      const weightKg = quantity * 0.4; // peso líquido estimado por unidade
      const antidumpingFee = (rule.antidumpingFeeKgUsd || 4.10) * weightKg;
      alerts.push({
        id: `alt-eng-${alertIdCounter++}`,
        severity: 'red',
        title: `Aplicação de Direitos Antidumping Ativos - NCM ${rule.ncm}`,
        description: `O item "${item.description}" originário da China está sujeito à sobretaxa antidumping compulsória vigente na alfândega brasileira.`,
        baseLegal: 'Resolução GECEX nº 227/2021 (Recipientes térmicos de aço inox).',
        impactoFinanceiro: `Cobrança de encargo compensatório de USD ${antidumpingFee.toFixed(2)} (aprox. R$ ${(antidumpingFee * USD_BRL).toFixed(2)}) com base na alíquota de USD ${rule.antidumpingFeeKgUsd?.toFixed(2) || '4.10'}/kg sobre o peso líquido total da carga.`,
        planoAcao: 'Provisionar o pagamento extra do imposto antidumping no registro da DI/Duimp, ou homologar produtores alternativos em países isentos.',
        affectedItems: [item.description]
      });
    }

    // 3. RED - Anuência prévia ANVISA
    if (rule.requiresAnvisa) {
      alerts.push({
        id: `alt-eng-${alertIdCounter++}`,
        severity: 'red',
        title: `Anuência Prévia Obrigatória (ANVISA) - NCM ${rule.ncm}`,
        description: `A NCM do produto "${item.description}" exige Licença de Importação (LI) autorizada pela ANVISA de forma prévia ao embarque físico do exterior.`,
        baseLegal: 'RDC nº 752/2022 ANVISA e Portaria SECEX nº 23/2011.',
        impactoFinanceiro: 'Multa pecuniária automática de 1% do valor aduaneiro (mínimo de R$ 500,00) por embarcar sem LI aprovada na origem, além de potencial obrigação de reexportar o lote.',
        planoAcao: 'Protocolar e deferir o pedido de LI no Siscomex antes da data de emissão do Bill of Lading (B/L) no exterior.',
        affectedItems: [item.description]
      });
    }

    // 4. YELLOW - Conflito ANVISA vs MAPA
    if (rule.checkMapaConflict) {
      const hasIngredients = ['aloe', 'organic', 'plant', 'vegetal', 'chamomile', 'extract', 'natural', 'oil', 'beeswax', 'honey', 'animal'].some(kw => descLower.includes(kw));
      if (hasIngredients) {
        alerts.push({
          id: `alt-eng-${alertIdCounter++}`,
          severity: 'yellow',
          title: 'Risco de Conflito de Competência ANVISA vs. MAPA',
          description: `A descrição comercial de "${item.description}" menciona compostos de origem vegetal ou orgânica, o que frequentemente gera conflito de fiscalização e exigência de dupla anuência (Saúde + Agricultura).`,
          baseLegal: 'Instrução Normativa Conjunta MAPA/ANVISA nº 01/2012 e Decreto nº 4.412/2002.',
          impactoFinanceiro: 'Atraso estimado de 30 a 45 dias no desembaraço aduaneiro portuário para emissão de parecer do MAPA, gerando custos adicionais de armazenagem e demurrage superiores a R$ 15.000,00.',
          planoAcao: 'Apresentar laudo técnico do fabricante comprovando que as matérias-primas vegetais passaram por processo químico de purificação e sintetização de grau puramente cosmético.',
          affectedItems: [item.description]
        });
      }
    }

    // 5. YELLOW - Marcas de alto risco (antipirataria)
    const hasBrand = ['stanley', 'apple', 'nike', 'samsung', 'yeti', 'brand'].some(kw => descLower.includes(kw));
    if (hasBrand) {
      alerts.push({
        id: `alt-eng-${alertIdCounter++}`,
        severity: 'yellow',
        title: `Controle Antipirataria de Marca Registrada - NCM ${rule.ncm}`,
        description: `A mercadoria "${item.description}" ostenta marca de alta reputação, monitorada prioritariamente pelo setor de combate à contrafação aduaneira.`,
        baseLegal: 'Artigos 190 a 195 da Lei Federal de Propriedade Industrial (Lei nº 9.279/1996) e Art. 605 do Regulamento Aduaneiro.',
        impactoFinanceiro: 'Retenção física no canal vermelho para vistoria e coleta de amostras. Caso seja confirmada pirataria, o lote integral de mercadorias é apreendido para destruição oficial, com denúncia-crime contra o importador.',
        planoAcao: 'Apresentar a autorização de comercialização (Brand License/Consent Certificate) emitida diretamente pelo titular da marca registrada no Brasil.',
        affectedItems: [item.description]
      });
    }

    // 6. YELLOW - Homologação ANATEL
    if (rule.requiresAnatel || descLower.includes('wi-fi') || descLower.includes('wifi') || descLower.includes('bluetooth') || descLower.includes('remote')) {
      alerts.push({
        id: `alt-eng-${alertIdCounter++}`,
        severity: 'yellow',
        title: `Exigência de Homologação ANATEL (Emissor de Rádio) - NCM ${rule.ncm}`,
        description: `O item "${item.description}" possui tecnologia sem fio (transmissor RF), o que obriga a apresentação do certificado de homologação da ANATEL antes da liberação aduaneira.`,
        baseLegal: 'Lei Geral de Telecomunicações nº 9.472/1997 e Resolução nº 715/2019 da ANATEL.',
        impactoFinanceiro: 'Bloqueio de importação e retenção na alfândega do aeroporto. Custo para homologação por OCD estimado em R$ 10.000,00 por família de equipamento eletrônico.',
        planoAcao: 'Verificar se o transmissor de rádio embutido já possui homologação ativa no Brasil por parte do fornecedor, anexando o código oficial no Siscomex.',
        affectedItems: [item.description]
      });
    }

    // 7. GREEN - Ex-Tarifário
    if (rule.hasExTarifario) {
      const savings = (rule.standardIiRate - (rule.exTarifarioRate || 0)) / 100 * totalItemPrice;
      alerts.push({
        id: `alt-eng-${alertIdCounter++}`,
        severity: 'green',
        title: `Oportunidade: Redução de II via Ex-Tarifário Ativo - NCM ${rule.ncm}`,
        description: `A NCM ${rule.ncm} possui o benefício do Ex-Tarifário ativo, reduzindo o Imposto de Importação padrão de ${rule.standardIiRate}% para ${rule.exTarifarioRate || 0}%.`,
        baseLegal: 'Regime de Ex-Tarifário para fomento de bens de capital e insumos industriais.',
        impactoFinanceiro: `Economia tributária de II direta no desembaraço estimada em USD ${savings.toFixed(2)} (cerca de R$ ${(savings * USD_BRL).toFixed(2)}) de desembolso financeiro aduaneiro.`,
        planoAcao: 'Fazer constar na descrição da adição da DI o enquadramento perfeito das especificações físico-químicas ou mecânicas exigidas no texto do decreto outorgante.',
        affectedItems: [item.description]
      });
    }

    // 8. GREEN - PIS/COFINS zero por finalidade
    if (rule.hasPisCofinsZeroOpportunity) {
      const savings = 0.1175 * totalItemPrice;
      alerts.push({
        id: `alt-eng-${alertIdCounter++}`,
        severity: 'green',
        title: `Oportunidade: Desoneração de PIS/COFINS por Finalidade - NCM ${rule.ncm}`,
        description: 'A aplicação deste insumo para a fabricação direta de tintas protetivas industriais garante isenção/alíquota zero das contribuições sociais federais de entrada.',
        baseLegal: rule.pisCofinsZeroBasis || 'Lei Federal nº 10.865/2004, Artigo 8º, § 11.',
        impactoFinanceiro: `Economia de 11.75% sobre a base tributária federal de PIS/COFINS-Importação, resultando em USD ${savings.toFixed(2)} (cerca de R$ ${(savings * USD_BRL).toFixed(2)}) de caixa otimizado.`,
        planoAcao: 'Elaborar laudo de destinação assinado pelo engenheiro industrial do importador e declarar a finalidade correspondente no registro da DI.',
        affectedItems: [item.description]
      });
    }
  });

  let score = 5;
  alerts.forEach(a => {
    if (a.severity === 'red') score += 35;
    if (a.severity === 'yellow') score += 12;
  });

  return { alerts, riskScore: Math.min(score, 100) };
}

/** Economia potencial (R$) via Ex-Tarifário e PIS/COFINS zero, para o card de métricas. */
export function computeSavingsBrl(items: InvoiceItem[], rules: NcmRule[]): number {
  return items.reduce((total, item) => {
    const rule = findRuleForNcm(item.ncm, rules);
    if (!rule) return total;
    let itemSavings = 0;
    if (rule.hasExTarifario) {
      itemSavings += ((rule.standardIiRate - (rule.exTarifarioRate || 0)) / 100) * item.totalPrice;
    }
    if (rule.hasPisCofinsZeroOpportunity) {
      itemSavings += 0.1175 * item.totalPrice;
    }
    return total + itemSavings * USD_BRL;
  }, 0);
}

/**
 * Fallback offline: extrai itens por heurística de palavras-chave quando o
 * backend/Gemini está indisponível, e roda o mesmo motor de alertas.
 */
export function buildHeuristicAnalysis(text: string, rules: NcmRule[]): InvoiceAnalysis {
  const items: InvoiceItem[] = [];

  if (/stanley|mug|tumbler|cup|vacuum/i.test(text)) {
    items.push({
      id: 'item-heur-1',
      description: 'Vacuum Insulated Stainless Steel Tumbler (Stanley-Style)',
      ncm: '9617.00.10',
      unitPrice: 2.20,
      currency: 'USD',
      quantity: 5000,
      totalPrice: 11000.00,
      countryOfOrigin: 'China',
      additionalDetails: 'FOB Ningbo Port. Weight: 2,000 kg total.'
    });
  }
  if (/cosmetic|cream|gel|aloe|moisturizer|face/i.test(text)) {
    items.push({
      id: 'item-heur-2',
      description: 'Organic Aloe Vera Extract Beauty Facial Gel',
      ncm: '3304.99.90',
      unitPrice: 1.10,
      currency: 'USD',
      quantity: 3000,
      totalPrice: 3300.00,
      countryOfOrigin: 'China',
      additionalDetails: 'Cosmetic gel with organic herbal components.'
    });
  }
  if (/resin|epoxy|epoxide|chemical/i.test(text)) {
    items.push({
      id: 'item-heur-3',
      description: 'High Grade Industrial Epoxy Liquid Resin EP-44',
      ncm: '3907.30.22',
      unitPrice: 4.50,
      currency: 'USD',
      quantity: 10000,
      totalPrice: 45000.00,
      countryOfOrigin: 'USA',
      additionalDetails: 'Epóxi liquid base resin.'
    });
  }
  if (/drone|quadcopter|aircraft|uav/i.test(text)) {
    items.push({
      id: 'item-heur-4',
      description: 'Industrial Inspection Drone with Wi-Fi module',
      ncm: '8806.92.00',
      unitPrice: 580.00,
      currency: 'USD',
      quantity: 20,
      totalPrice: 11600.00,
      countryOfOrigin: 'China',
      additionalDetails: 'UAV drone.'
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'item-heur-5',
      description: 'Custom Hand-Typed Product (NCM 3304.99.90)',
      ncm: '3304.99.90',
      unitPrice: 1.50,
      currency: 'USD',
      quantity: 1000,
      totalPrice: 1500.00,
      countryOfOrigin: 'China',
      additionalDetails: 'Generic fallback product.'
    });
  }

  const { alerts, riskScore } = computeAlerts(items, rules);

  return {
    fileName: 'COMANDO_CHAT_AUDIT.txt',
    analyzedAt: new Date().toISOString(),
    items,
    alerts,
    riskScore,
    totalFobUsd: items.reduce((acc, c) => acc + c.totalPrice, 0),
    currency: 'USD',
    isCustomUpload: true
  };
}
