/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InvoiceAnalysis, NcmRule } from '../types';

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

export const PRESET_SCENARIOS: InvoiceAnalysis[] = [
  {
    fileName: 'INVOICE_AMOUR_88402.pdf',
    analyzedAt: '2026-07-17T10:15:00-03:00',
    totalFobUsd: 17100.00,
    currency: 'USD',
    isCustomUpload: false,
    riskScore: 88,
    items: [
      {
        id: 'item-1',
        description: 'Organic Aloe Vera Extract Facial Gel - 150ml (Natural Formula)',
        ncm: '3304.99.90',
        unitPrice: 1.20,
        currency: 'USD',
        quantity: 8000,
        totalPrice: 9600.00,
        countryOfOrigin: 'China',
        additionalDetails: 'Ingredients: Water, Organic Aloe Vera Leaf Juice, Glycerin, Carbomer, Triethanolamine, Organic Chamomile Extract, Phenoxyethanol.'
      },
      {
        id: 'item-2',
        description: 'Youth Revitalizing Night Moisturizer - 50g Premium Glass Jar',
        ncm: '3304.99.90',
        unitPrice: 1.50,
        currency: 'USD',
        quantity: 5000,
        totalPrice: 7500.00,
        countryOfOrigin: 'China',
        additionalDetails: 'Cosmetic cream for facial treatment. Ingredients: Shea Butter, Macadamia Oil, Sodium Hyaluronate, Tocopherol, Aqua.'
      }
    ],
    alerts: [
      {
        id: 'alt-101',
        severity: 'red',
        title: 'Exigência de Anuência Prévia (ANVISA) - LI antes do Embarque',
        description: 'Os itens importados pertencem à categoria de cosméticos (NCM 3304.99.90), os quais estão sujeitos ao controle de vigilância sanitária pela ANVISA e exigem Licença de Importação (LI) registrada e deferida ANTES da data de embarque no exterior.',
        baseLegal: 'Resolução da Diretoria Colegiada - RDC nº 752/2022 da ANVISA e Portaria SECEX nº 23/2011.',
        impactoFinanceiro: 'Caso a carga seja embarcada sem a LI prévia, o importador estará sujeito a uma multa pecuniária aduaneira de 1% do valor aduaneiro (mínimo de R$ 500,00 por operação) nos termos do Art. 706 do Regulamento Aduaneiro, além do risco severo de repatriação compulsória da carga pelo fiscal do porto.',
        planoAcao: 'Registrar e deferir a Licença de Importação (LI) no Siscomex antes da data em que a carga for entregue à transportadora internacional na China.',
        affectedItems: ['Organic Aloe Vera Extract Facial Gel', 'Youth Revitalizing Night Moisturizer']
      },
      {
        id: 'alt-102',
        severity: 'red',
        title: 'Risco de Subfaturamento (Canal Cinza - RFB)',
        description: 'O preço unitário declarado para o item "Organic Aloe Vera Extract Facial Gel" (USD 1,20) e "Youth Revitalizing Night Moisturizer" (USD 1,50) encontra-se anomalamente abaixo do preço de referência de mercado ($3,50) para cosméticos sob a NCM 3304.99.90.',
        baseLegal: 'Instrução Normativa RFB nº 1986/2020 (Procedimento Especial de Fiscalização de Combate à Fraude Aduaneira) e Art. 86 da Medida Provisória nº 2.158-35/2001.',
        impactoFinanceiro: 'Retenção integral das mercadorias em recinto alfandegado pelo setor de Valoração Aduaneira da Receita Federal por até 90 dias (prorrogáveis por mais 90), sob suspeita de fraude. Para liberação liminar, será exigido depósito de caução no valor integral do imposto recalculado. Em caso de condenação, aplica-se multa de 100% sobre a diferença de preço mais recolhimento compulsório da diferença dos impostos federais (II, IPI, PIS, COFINS).',
        planoAcao: 'Solicitar preventivamente ao exportador o fluxograma detalhado de custos (cost breakdown), invoice proforma, declaração do fabricante de autenticidade dos valores e os extratos Swift bancários demonstrando a remessa integral e antecipada do pagamento.',
        affectedItems: ['Organic Aloe Vera Extract Facial Gel', 'Youth Revitalizing Night Moisturizer']
      },
      {
        id: 'alt-103',
        severity: 'yellow',
        title: 'Conflito Regulatório ANVISA vs. MAPA (Dupla Anuência)',
        description: 'A descrição comercial do produto facial indica expressamente componentes de origem vegetal ("Aloe Vera Extract", "Chamomile Extract") e rotulagem "Organic". Há alta probabilidade de o fiscal ou sistema do Siscomex direcionar o processo para análise conjunta do Ministério da Agricultura (MAPA) para certificar a autenticidade orgânica e ausência de fitopatógenos.',
        baseLegal: 'Decreto Federal nº 4.412/2002 (Regulamentação de Produtos Orgânicos) e Instrução Normativa Conjunta MAPA/ANVISA nº 01/2012.',
        impactoFinanceiro: 'Retenção temporária para trâmite interministerial de análise técnica, gerando atraso de 30 a 45 dias no fluxo do porto. Custos estimados de armazenagem de terminal alfandegado e demurrage do contêiner superiores a USD 4,500.00 (aprox. R$ 24.750,00).',
        planoAcao: 'Dispor de Certificado de Produtos Orgânicos emitido por certificadora autorizada pelo MAPA ou ajustar a descrição aduaneira para frisar apenas o nome comercial de grau cosmético químico purificado, evitando termos excessivos de taxonomia agrícola.',
        affectedItems: ['Organic Aloe Vera Extract Facial Gel']
      }
    ]
  },
  {
    fileName: 'INVOICE_SUMMIT_STANLEY.pdf',
    analyzedAt: '2026-07-17T10:45:00-03:00',
    totalFobUsd: 48600.00,
    currency: 'USD',
    isCustomUpload: false,
    riskScore: 95,
    items: [
      {
        id: 'item-3',
        description: 'Double-Wall Stainless Steel Vacuum Insulated Tumbler - "Stanley" brand',
        ncm: '9617.00.10',
        unitPrice: 2.50,
        currency: 'USD',
        quantity: 12000,
        totalPrice: 30000.00,
        countryOfOrigin: 'China',
        additionalDetails: 'FOB Ningbo Port. Product weight: 0.40 kg per unit. Material: Grade 304 Stainless Steel, BPA free lid.'
      },
      {
        id: 'item-4',
        description: 'Insulated Travel Mug with Leakproof Lid (Unbranded style)',
        ncm: '9617.00.10',
        unitPrice: 3.10,
        currency: 'USD',
        quantity: 6000,
        totalPrice: 18600.00,
        countryOfOrigin: 'China',
        additionalDetails: 'FOB Ningbo Port. Product weight: 0.40 kg per unit. Packaging: individual cardboard box.'
      }
    ],
    alerts: [
      {
        id: 'alt-201',
        severity: 'red',
        title: 'Aplicação Obrigatória de Direitos Antidumping Ativos',
        description: 'Garrafas térmicas de aço inox com vácuo originárias da China, classificadas sob a NCM 9617.00.10, estão sujeitas a direitos antidumping definitivos vigentes na importação brasileira.',
        baseLegal: 'Resolução GECEX nº 227/2021 (Medida comercial compensatória da CAMEX).',
        impactoFinanceiro: 'Cobrança de sobretaxa antidumping compulsória fixa no valor de USD 4,10 por quilograma líquido de produto. Com um peso total de carga de 7.200 kg (0.4 kg por copo), a taxa antidumping líquida a recolher no desembaraço aduaneiro é de USD 29.520,00 (aprox. R$ 162.360,00), elevando em quase 61% o custo fiscal original das mercadorias.',
        planoAcao: 'Calcular preventivamente o impacto do recolhimento adiantado na DI ou cogitar a troca do polo fabril do exportador para países isentos da sobretaxa compensatória aduaneira (ex: Índia, Turquia ou Coreia do Sul).',
        affectedItems: ['Double-Wall Stainless Steel Vacuum Insulated Tumbler - "Stanley" brand', 'Insulated Travel Mug with Leakproof Lid (Unbranded style)']
      },
      {
        id: 'alt-202',
        severity: 'red',
        title: 'Risco Gravíssimo de Subfaturamento em Mercadoria Regulada',
        description: 'O valor unitário declarado para os copos isotérmicos vácuo de aço inox (USD 2,50 e USD 3,10) está flagrantemente abaixo do preço de referência de valoração aduaneira fixado pela RFB para essa NCM (USD 9,50), o que em processos de antidumping gera presunção imediata de fraude comercial.',
        baseLegal: 'Art. 60 da IN RFB nº 1986/2020 e regras internacionais de Valoração Aduaneira (Acordo de Valoração Aduaneira da OMC - Art. 1º).',
        impactoFinanceiro: 'Interrupção imediata do fluxo de desembaraço com parametrização para o Canal Vermelho/Cinza. Arbitramento oficial do valor para USD 9,50, aplicando-se multa punitiva tributária de 100% sobre o montante sonegado, mais multa por infração à legislação do comércio exterior de 1.5% do valor da mercadoria.',
        planoAcao: 'Fornecer os comprovantes de fluxo financeiro (L/C, ordem de pagamento bancária homologada), declaração de custos do aço inox de Hangzhou e assegurar a prova física de transação real.',
        affectedItems: ['Double-Wall Stainless Steel Vacuum Insulated Tumbler - "Stanley" brand', 'Insulated Travel Mug with Leakproof Lid (Unbranded style)']
      },
      {
        id: 'alt-203',
        severity: 'yellow',
        title: 'Controle de Propriedade Intelectual (Combate à Pirataria - Stanley)',
        description: 'A descrição da Invoice estampa a marca nominativa de alto risco de falsificação comercial ""Stanley"". A NCM 9617.00.10 é objeto de monitoramento prioritário contra pirataria pelas alfândegas de Santos e Paranaguá.',
        baseLegal: 'Artigos 198 a 204 da Lei Federal nº 9.279/1996 (LPI) e Art. 605 do Decreto nº 6.759/2009 (Regulamento Aduaneiro).',
        impactoFinanceiro: 'Retenção física para laudo pericial técnico convocando os representantes da marca no Brasil. Constatada qualquer discrepância ou falta de licença, a carga total é declarada pirata, sujeita à pena de perdimento definitivo de bens (confisco) para destruição obrigatória, além de denúncia criminal ao Ministério Público Federal.',
        planoAcao: 'Apresentar previamente a Licença Oficial de Distribuição Internacional fornecida pela PMI (fabricante da Stanley) comprovando a procedência e autorização para importação da marca registrada.',
        affectedItems: ['Double-Wall Stainless Steel Vacuum Insulated Tumbler - "Stanley" brand']
      }
    ]
  },
  {
    fileName: 'INVOICE_TEXAS_CHEM_EPX2026.pdf',
    analyzedAt: '2026-07-17T11:00:00-03:00',
    totalFobUsd: 72000.00,
    currency: 'USD',
    isCustomUpload: false,
    riskScore: 10,
    items: [
      {
        id: 'item-5',
        description: 'Special Epoxide Resin Grade EP-44 for Paint Industry (Liquid formulation)',
        ncm: '3907.30.22',
        unitPrice: 4.80,
        currency: 'USD',
        quantity: 15000,
        totalPrice: 72000.00,
        countryOfOrigin: 'USA',
        additionalDetails: 'FOB Houston. Net weight: 15,000 kg in heavy industrial plastic drums. Non-hazardous chemicals.'
      }
    ],
    alerts: [
      {
        id: 'alt-301',
        severity: 'green',
        title: 'Oportunidade de Isenção / Alíquota Zero de PIS/COFINS-Importação',
        description: 'Matérias-primas de resina epóxi (NCM 3907.30.22) quando comprovadamente importadas por estabelecimento industrial destinadas à fabricação direta de tintas, vernizes ou formulações de revestimento protetivo e de sinalização de vias, podem desfrutar do benefício de alíquota zero das contribuições sociais de importação.',
        baseLegal: 'Lei Federal nº 10.865/2004, Artigo 8º, § 11 e normativas correlatas de fomento à indústria nacional de tintas.',
        impactoFinanceiro: 'Redução imediata da carga tributária em 11.75% (sendo 2.1% de PIS e 9.65% de COFINS sobre a base de cálculo). Nesta fatura de USD 72,000.00, a economia fiscal em guias federais representa USD 8,460.00 (aproximadamente R$ 46.530,00).',
        planoAcao: 'Emitir Declaração de Compromisso e Finalidade Industrial assinada pelo engenheiro químico responsável da fábrica de tintas adquirente e parametrizar o código de redução de tributo correspondente na adição da Declaração de Importação.',
        affectedItems: ['Special Epoxide Resin Grade EP-44 for Paint Industry (Liquid formulation)']
      },
      {
        id: 'alt-302',
        severity: 'green',
        title: 'Benefício Ativo de Ex-Tarifário (Redução de II para 0%)',
        description: 'Identificamos a presença do Ex-Tarifário nº 002 ativo aplicável exatamente às especificações de resinas líquidas especiais anti-corrosivas importadas sob a NCM 3907.30.22.',
        baseLegal: 'Resolução GECEX SECEX sobre regimes aduaneiros especiais de Bens de Capital e Insumos Industriais.',
        impactoFinanceiro: 'Redução automática da alíquota do Imposto de Importação (II) de 14% padrão para 0%. Economia direta de USD 10,080.00 (cerca de R$ 55.440,00) em pagamento de tributos aduaneiros de entrada.',
        planoAcao: 'Mencionar formalmente o número do Ex-Tarifário nas adições da Declaração de Importação, garantindo que o laudo de laje técnica e a ficha química do produto exportado descrevam fielmente as características físicas exigidas pelo ato outorgante do Ex-Tarifário.',
        affectedItems: ['Special Epoxide Resin Grade EP-44 for Paint Industry (Liquid formulation)']
      }
    ]
  },
  {
    fileName: 'INVOICE_AEROTECH_8811.pdf',
    analyzedAt: '2026-07-17T11:10:00-03:00',
    totalFobUsd: 34750.00,
    currency: 'USD',
    isCustomUpload: false,
    riskScore: 50,
    items: [
      {
        id: 'item-6',
        description: 'Industrial Aerial Inspection Quadcopter Drone "AeroScan X1"',
        ncm: '8806.92.00',
        unitPrice: 650.00,
        currency: 'USD',
        quantity: 50,
        totalPrice: 32500.00,
        countryOfOrigin: 'China',
        additionalDetails: 'FOB Shenzhen. Embedded battery (LiPo 12V), 4K optical zoom camera, heavy weather-proof chassis.'
      },
      {
        id: 'item-7',
        description: 'Embedded Dual-Band Wi-Fi 2.4/5GHz Controller Transceiver Module',
        ncm: '8517.62.77',
        unitPrice: 45.00,
        currency: 'USD',
        quantity: 50,
        totalPrice: 2250,
        countryOfOrigin: 'China',
        additionalDetails: 'Standard RF transceiver for remote operations. Output power: 20dBm.'
      }
    ],
    alerts: [
      {
        id: 'alt-401',
        severity: 'yellow',
        title: 'Obrigatoriedade de Homologação de Radiofrequência (ANATEL)',
        description: 'Os transmissores de controle remoto e módulos de frequência de rádio Wi-Fi (NCM 8517.62.77) que integram os drones transmitem dados sem fio nas bandas comerciais e requerem homologação e certificação formal da ANATEL antes de serem disponibilizados para liberação aduaneira ou comércio no território nacional.',
        baseLegal: 'Lei nº 9.472/1997 (Lei Geral de Telecomunicações - LGT) e Resolução nº 715/2019 da ANATEL.',
        impactoFinanceiro: 'Retenção temporária indefinida da mercadoria na alfândega do aeroporto de Viracopos ou porto de Santos. Risco de multa administrativa por contrabando de telecomunicação de R$ 5.000,00 e pena de apreensão do lote caso o importador não apresente o Certificado de Homologação em tempo hábil. O custo de um processo de homologação novo é de aprox. R$ 12.000,00 por família de dispositivo.',
        planoAcao: 'Apresentar a homologação pré-existente do fabricante para os transmissores RF no Brasil ou vincular o processo aduaneiro a um distribuidor autorizado detentor da homologação de equipamentos ANATEL.',
        affectedItems: ['Embedded Dual-Band Wi-Fi 2.4/5GHz Controller Transceiver Module', 'Industrial Aerial Inspection Quadcopter Drone "AeroScan X1"']
      },
      {
        id: 'alt-402',
        severity: 'yellow',
        title: 'Exigência de Cadastro de Aeronave não Tripulada (ANAC / SISANT)',
        description: 'Drones comerciais e civis de peso superior a 250g (NCM 8806.92.00) exigem cadastro no sistema SISANT da ANAC (Agência Nacional de Aviação Civil) e anuência de plano de voo no DECEA.',
        baseLegal: 'Regulamento Brasileiro de Aviação Civil Especial RBAC-E nº 94 da ANAC.',
        impactoFinanceiro: 'Bloqueio do desembaraço físico da mercadoria sob suspeita de uso ilícito ou aviação irregular. O atraso na liberação acarreta multas de armazenagem e capatazias de cerca de R$ 1.500,00 por dia de retenção.',
        planoAcao: 'Efetuar o cadastro provisório dos drones no sistema SISANT fornecendo os números de série (Serial Numbers) constantes na lista de embalagem (Packing List) do fabricante antes de iniciar o registro de despacho.',
        affectedItems: ['Industrial Aerial Inspection Quadcopter Drone "AeroScan X1"']
      }
    ]
  }
];
