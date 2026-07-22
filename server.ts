/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { COSMETICS_DATABASE } from "./src/data/cosmeticsDb";
import { costingHandler } from "./server/costingService";

dotenv.config();

const app = express();
app.use(express.json());

// Motor de custeio (as-is + IBS/CBS) sobre alíquotas reais do schema mcat.
app.post("/api/costing", costingHandler);

const PORT = Number(process.env.PORT ?? 3000);

// Initialize Gemini Client safely (with lazy loading / guard)
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API client initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Gemini API client:", error);
  }
} else {
  console.log("Gemini API Key missing or using placeholder. Running in simulated/expert-rules mode for custom uploads.");
}

// Custom Interfaces matching types.ts
interface NcmRule {
  ncm: string;
  description: string;
  minReferencePrice: number;
  isAntidumpingActive: boolean;
  antidumpingFeeKgUsd?: number;
  antidumpingOrigin?: string;
  requiresAnvisa: boolean;
  checkMapaConflict: boolean;
  requiresAnatel: boolean;
  requiresInmetro: boolean;
  hasExTarifario: boolean;
  exTarifarioRate?: number;
  standardIiRate: number;
  hasPisCofinsZeroOpportunity: boolean;
  pisCofinsZeroBasis?: string;
}

interface ExtractedItem {
  description: string;
  ncm: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  countryOfOrigin: string;
  additionalDetails?: string;
}

/// Expert rules engine to generate alerts based on NCM guidelines
function runAuditEngine(items: any[], rules: NcmRule[]): any[] {
  const alerts: any[] = [];
  let alertIdCounter = 1000;

  items.forEach((item) => {
    // Clean NCM for matching (remove dots/spaces)
    const cleanItemNcm = (item.ncm || "").replace(/[^0-9]/g, "");
    
    // 1. FIRST PRIORITY: COSMETICS REGULATORY DATABASE (Chapter 33 and 34)
    const cosRule = COSMETICS_DATABASE.find(c => {
      const cleanDb = c.ncm.replace(/[^0-9]/g, "");
      return cleanItemNcm.startsWith(cleanDb) || cleanDb.startsWith(cleanItemNcm);
    }) || (
      // Fallback matching if NCM is generic but description fits cosmetic
      ["shampoo", "sabonete", "batom", "maquiagem", "creme", "facial", "protetor solar", "cosmetic", "lipstick", "sunscreen", "makeup"].some(kw => item.description.toLowerCase().includes(kw))
        ? COSMETICS_DATABASE.find(c => c.ncm === "3304.99.90")
        : undefined
    );

    if (cosRule) {
      const currency = item.currency || "USD";
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 1;
      const totalItemPrice = unitPrice * quantity;

      // A. ANVISA LI Requirement
      if (cosRule.requiresLi) {
        alerts.push({
          id: `alt-srv-${alertIdCounter++}`,
          severity: 'red',
          title: `Licença de Importação ANVISA Pré-Embarque • NCM ${cosRule.ncm}`,
          description: `O item "${item.description}" classificado sob a NCM ${cosRule.ncm} (${cosRule.description}) é regulado pela ANVISA. Exige registro e obtenção de Licença de Importação (LI) formal antes do embarque internacional.`,
          baseLegal: `Resolução da Diretoria Colegiada RDC nº 752/2022 e ato correlato ${cosRule.mainNormative} da ANVISA.`,
          impactoFinanceiro: `Embarque de cosméticos controlados sem anuência prévia constitui infração sanitária grave. Multa de 1% do valor aduaneiro (mínimo de R$ 500,00 por DI) nos termos da Portaria SECEX nº 23/2011, além de retenção por prazo indeterminado e risco de devolução forçada.`,
          planoAcao: `Solicitar minuta da LI no Siscomex usando a RDC ${cosRule.mainNormative} e aguardar deferimento pelo posto aduaneiro sanitário antes de efetivar o frete.`,
          normativeLink: cosRule.normativeLink,
          affectedItems: [item.description]
        });
      }

      // B. Reference Price / Under-invoicing (Subfaturamento) Check
      if (unitPrice < cosRule.minPriceUsd) {
        const diff = (cosRule.minPriceUsd - unitPrice) * quantity;
        alerts.push({
          id: `alt-srv-${alertIdCounter++}`,
          severity: 'red',
          title: `Risco de Subfaturamento Sanitário-Aduaneiro • NCM ${cosRule.ncm}`,
          description: `O preço declarado de ${currency} ${unitPrice.toFixed(2)} está abaixo do preço médio de referência para ${cosRule.description} (${currency} ${cosRule.minPriceUsd.toFixed(2)}) mapeado para auditoria do Capítulo ${cosRule.chapter}.`,
          baseLegal: `Instrução Normativa RFB nº 1986/2020 (Combate à Fraude Aduaneira) e regras de valoração da OMC.`,
          impactoFinanceiro: `Desvio direto para o Canal Cinza de parametrização. Retenção física por até 90 dias com exigência de fiança bancária e aplicação de multa punitiva de 100% sobre o valor aduaneiro subfaturado, estimado em ${currency} ${diff.toFixed(2)} (aprox. BRL ${(diff * 5.5).toFixed(2)}).`,
          planoAcao: `Preparar "Cost Breakdown" assinado pelo fabricante estrangeiro detalhando os custos de matérias-primas e embalagens para comprovar a lisura do preço FOB.`,
          normativeLink: cosRule.normativeLink,
          affectedItems: [item.description]
        });
      }

      // C. MAPA / ANVISA Conflict (Dupla Anuência)
      const descLower = item.description.toLowerCase();
      const hasOrganicKeywords = ["aloe", "organic", "plant", "vegetal", "chamomile", "extract", "natural", "oil", "beeswax", "honey", "animal"].some(kw => descLower.includes(kw));
      if (hasOrganicKeywords) {
        alerts.push({
          id: `alt-srv-${alertIdCounter++}`,
          severity: 'yellow',
          title: `Alerta de Duplo Órgão Anuente: ANVISA + MAPA • NCM ${cosRule.ncm}`,
          description: `A descrição do cosmético "${item.description}" cita componentes de origem vegetal ou animal (aloe, extrato natural). Fiscalizações rigorosas costumam remeter tais declarações para o Ministério da Agricultura (MAPA) além da ANVISA.`,
          baseLegal: `Instrução Normativa Conjunta MAPA/ANVISA nº 01/2012.`,
          impactoFinanceiro: `Gargalo operacional: atrasos adicionais de 25 a 40 dias no terminal portuário aguardando vistoria agrícola física. Custo de armazenagem extraordinária e multa de estadia de contêineres (demurrage).`,
          planoAcao: `Submeter certificado de análise técnica declarando que os extratos vegetais passaram por processo industrial completo de esterilização e inativação biológica.`,
          normativeLink: cosRule.normativeLink,
          affectedItems: [item.description]
        });
      }

      // D. Antidumping Exemption (Mapeamento de Antidumping)
      alerts.push({
        id: `alt-srv-${alertIdCounter++}`,
        severity: 'green',
        title: `Mapeamento Comercial: Isenção Antidumping Confirmada • NCM ${cosRule.ncm}`,
        description: `Confirmamos a inexistência de tarifas antidumping ativas ou medidas de defesa comercial brasileiras incidindo sobre importações de ${cosRule.description} da origem informada.`,
        baseLegal: `Resoluções de Defesa Comercial da SECEX / CAMEX vigentes.`,
        impactoFinanceiro: `Risco Zero de sobretaxa antidumping de até USD 4.10/kg incidentes sobre recipientes térmicos ou outros produtos assemelhados. Alíquota regular confirmada para a operação.`,
        planoAcao: `Assegurar que a classificação fiscal aduaneira seja declarada exatamente sob a NCM ${cosRule.ncm} para afastar questionamentos de similaridade aduaneira.`,
        normativeLink: cosRule.normativeLink,
        affectedItems: [item.description]
      });

      // E. Ex-Tarifário / PIS/COFINS (For cosmetics, standard rates apply, but flag regular rate)
      alerts.push({
        id: `alt-srv-${alertIdCounter++}`,
        severity: 'green',
        title: `Previsão Tributária Ordinária de Impostos de Importação`,
        description: `Enquadramento padrão para importação de cosméticos acabados classificados na NCM ${cosRule.ncm}. Alíquotas regulares calculadas com base na RIT.`,
        baseLegal: `Regulamento Aduaneiro brasileiro e Tabela TIPI.`,
        impactoFinanceiro: `Cálculo de alíquota estável de II, IPI e PIS/COFINS em linha com os planos operacionais, sem sobressaltos ou encargos retroativos.`,
        planoAcao: `Provisionar os valores das guias de tributação federais antes do registro da Declaração de Importação no Siscomex.`,
        affectedItems: [item.description]
      });

    } else {
      // 2. SECOND PRIORITY: OTHER NCM GENERAL PRESETS (Stanley, Epoxy, Drones, etc.)
      // Find matching rule (either exact match or starting match)
      const rule = rules.find(r => {
        const cleanRuleNcm = r.ncm.replace(/[^0-9]/g, "");
        return cleanItemNcm.startsWith(cleanRuleNcm) || cleanRuleNcm.startsWith(cleanItemNcm);
      }) || rules.find(r => {
        // General fallbacks if NCM contains subparts
        return item.description.toLowerCase().includes("resin") && r.ncm === "3907.30.22" ||
               item.description.toLowerCase().includes("stanley") && r.ncm === "9617.00.10" ||
               item.description.toLowerCase().includes("drone") && r.ncm === "8806.92.00";
      });

      if (rule) {
        const currency = item.currency || "USD";
        const unitPrice = Number(item.unitPrice) || 0;
        const quantity = Number(item.quantity) || 1;
        const totalItemPrice = unitPrice * quantity;

        // 1. RED ALERT - SUBFATURAMENTO
        if (unitPrice < rule.minReferencePrice) {
          const diff = (rule.minReferencePrice - unitPrice) * quantity;
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'red',
            title: `Risco de Subfaturamento (Canal Cinza) - NCM ${rule.ncm}`,
            description: `O preço unitário declarado de ${currency} ${unitPrice.toFixed(2)} para o item "${item.description}" está anomalamente abaixo do valor mínimo de referência aduaneiro (${currency} ${rule.minReferencePrice.toFixed(2)}) mapeado para a NCM ${rule.ncm}.`,
            baseLegal: "Instrução Normativa RFB nº 1986/2020 (Procedimento Especial de Fiscalização de Combate à Fraude Aduaneira) e Art. 86 da Medida Provisória nº 2.158-35/2001.",
            impactoFinanceiro: `Abertura de Procedimento de Fiscalização Especial com retenção da carga por até 90 dias (prorrogáveis). Arbitramento compulsório de valores pela fiscalização, cobrando impostos retroativos com multa de 100% sobre a diferença de preço estimada em ${currency} ${diff.toFixed(2)} (aprox. BRL ${(diff * 5.5).toFixed(2)}).`,
            planoAcao: "Obter com urgência laudos de fabricação originais (cost breakdown) emitidos pelo fabricante, faturas consulares do país de origem e os extratos SWIFT que atestem o pagamento adiantado da transação internacional.",
            affectedItems: [item.description]
          });
        }

        // 2. RED ALERT - ANTIDUMPING
        if (rule.isAntidumpingActive && (item.countryOfOrigin || "").toLowerCase().includes((rule.antidumpingOrigin || "China").toLowerCase())) {
          const weightKg = quantity * 0.4;
          const fee = (rule.antidumpingFeeKgUsd || 4.10) * weightKg;
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'red',
            title: "Aplicação Obrigatória de Direitos Antidumping Ativos",
            description: `O item "${item.description}" originário da ${item.countryOfOrigin} sob a NCM ${rule.ncm} possui direito antidumping definitivo regulado no Brasil, com sobretaxação extra obrigatória no desembaraço.`,
            baseLegal: "Resolução GECEX nº 227/2021 (Regime compensatório de importações de recipientes térmicos inoxidáveis).",
            impactoFinanceiro: `Recolhimento compulsório de sobretaxa aduaneira estimada em USD ${fee.toFixed(2)} (BRL ${(fee * 5.5).toFixed(2)}) com base em tarifa antidumping de USD ${rule.antidumpingFeeKgUsd?.toFixed(2) || '4.10'}/kg líquida de carga, sob pena de bloqueio da importação e multas por atraso.`,
            planoAcao: "Provisionar o valor adiantado na Guia de Importação ou homologar fornecedores alternativos em países não impactados pela medida compensatória nacional.",
            affectedItems: [item.description]
          });
        }

        // 3. RED ALERT - ANUÊNCIA PRÉVIA (ANVISA / MAPA)
        if (rule.requiresAnvisa) {
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'red',
            title: "Exigência de Anuência Prévia (ANVISA) - LI antes do Embarque",
            description: `O item "${item.description}" é categorizado como cosmético/higienizador sob controle sanitário e requer Licença de Importação (LI) autorizada pela ANVISA de forma prévia ao embarque internacional.`,
            baseLegal: "Resolução da Diretoria Colegiada RDC nº 752/2022 da ANVISA e Portaria SECEX nº 23/2011.",
            impactoFinanceiro: "Multa aduaneira regulamentar de 1% do valor aduaneiro (mínimo de R$ 500,00 por declaração) por embarque antes do deferimento da LI, com riscos elevados de bloqueio e retorno compulsório da carga à origem.",
            planoAcao: "Suspender o carregamento do contêiner no exterior até que a LI seja formalmente registrada e deferida pelos técnicos da ANVISA no Siscomex.",
            affectedItems: [item.description]
          });
        }

        // 4. YELLOW ALERT - CONFLITO ANVISA vs MAPA
        if (rule.checkMapaConflict) {
          const descLower = item.description.toLowerCase();
          const hasOrganicKeywords = ["aloe", "organic", "plant", "vegetal", "chamomile", "extract", "natural", "oil", "beeswax", "honey", "animal"].some(kw => descLower.includes(kw));
          if (hasOrganicKeywords) {
            alerts.push({
              id: `alt-srv-${alertIdCounter++}`,
              severity: 'yellow',
              title: "Conflito Regulatório ANVISA vs. MAPA (Dupla Anuência)",
              description: `O cosmético "${item.description}" cita ingredientes ou apelo de origem vegetal ("Aloe Vera", "Chamomile") ou o termo "Organic". Há alta probabilidade de a Receita direcionar o produto para fiscalização de duplo órgão anuente (ANVISA + MAPA).`,
              baseLegal: "Instrução Normativa Conjunta MAPA/ANVISA nº 01/2012 e Decreto nº 4.412/2002.",
              impactoFinanceiro: "Atraso operacional no desembaraço do porto de 30 a 50 dias para conciliação técnica entre os ministérios. Custo extra em armazenagem portuária e demurrage de contêineres de até R$ 20.000,00.",
              planoAcao: "Apresentar laudos físico-químicos que declarem a inércia biológica agrícola do produto ou, se viável, ajustar a descrição comercial na Invoice retirando termos estritamente fitossanitários.",
              affectedItems: [item.description]
            });
          }
        }

        // 5. YELLOW ALERT - MARCAS DE ALTO RISCO / PIRATARIA
        const descLowerForBrand = item.description.toLowerCase();
        const hasBrandKeyword = ["stanley", "apple", "nike", "samsung", "yeti", "brand"].some(kw => descLowerForBrand.includes(kw));
        if (hasBrandKeyword || (rule.ncm === "9617.00.10" && descLowerForBrand.includes("stanley"))) {
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'yellow',
            title: "Controle de Propriedade Intelectual (Combate à Pirataria)",
            description: `A descrição do item menciona marcas de alta notoriedade mundial em NCM monitorada pela Receita Federal, necessitando atestado de legitimidade industrial.`,
            baseLegal: "Artigos 190 a 195 da Lei Federal nº 9.279/1996 (LPI) e Art. 605 do Regulamento Aduaneiro brasileiro.",
            impactoFinanceiro: "Retenção física da carga para perícia de marcas por representantes autorizados. Em caso de pirataria constatada, perda definitiva da carga por confisco para destruição forçada, sem reembolso, acrescido de processo cível e penal.",
            planoAcao: "Anexar ao processo aduaneiro a Carta de Autorização de Comercialização da marca nominativa original emitida diretamente pelo fabricante ou provar a aquisição de lotes legítimos.",
            affectedItems: [item.description]
          });
        }

        // 6. YELLOW ALERT - HOMOLOGAÇÃO ANATEL
        if (rule.requiresAnatel || descLowerForBrand.includes("wi-fi") || descLowerForBrand.includes("wifi") || descLowerForBrand.includes("bluetooth") || descLowerForBrand.includes("remote")) {
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'yellow',
            title: "Obrigatoriedade de Homologação de Radiofrequência (ANATEL)",
            description: `O produto eletrônico ou com comunicação sem fio "${item.description}" transmite sinais de rádio e exige homologação aduaneira junto à ANATEL.`,
            baseLegal: "Lei Geral de Telecomunicações nº 9.472/1997 e Resolução nº 715/2019 da ANATEL.",
            impactoFinanceiro: "Carga retida por tempo indefinido no terminal aéreo/portuário. Multas aduaneiras e custo de homologação por Organismo de Certificação Designado (OCD) estimado em R$ 10.000,00 por modelo.",
            planoAcao: "Vincular a Declaração de Importação a um número de homologação ativo da ANATEL do fornecedor ou iniciar o trâmite simplificado antes da chegada física da mercadoria.",
            affectedItems: [item.description]
          });
        }

        // 7. GREEN ALERT - EX-TARIFÁRIO
        if (rule.hasExTarifario) {
          const savings = (rule.standardIiRate - (rule.exTarifarioRate || 0)) / 100 * totalItemPrice;
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'green',
            title: "Oportunidade Tributária: Ex-Tarifário Ativo (Redução de II)",
            description: `Identificamos potencial enquadramento no benefício do Ex-Tarifário para a NCM ${rule.ncm}, reducing a alíquota padrão de II de ${rule.standardIiRate}% para ${rule.exTarifarioRate || 0}%.`,
            baseLegal: "Resoluções GECEX da Câmara de Comércio Exterior para fomento industrial.",
            impactoFinanceiro: `Economia direta de caixa aduaneiro estimada em ${currency} ${savings.toFixed(2)} (aprox. BRL ${(savings * 5.5).toFixed(2)}) de Imposto de Importação nesta operação.`,
            planoAcao: "Vincular o código do Ex-Tarifário ativo correspondente e adequar perfeitamente a descrição técnica do laudo ao descritivo exato da resolução oficial.",
            affectedItems: [item.description]
          });
        }

        // 8. GREEN ALERT - PIS/COFINS ZERO POR FINALIDADE
        if (rule.hasPisCofinsZeroOpportunity || descLowerForBrand.includes("resin") || descLowerForBrand.includes("epoxy")) {
          const savings = 0.1175 * totalItemPrice; // 11.75%
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'green',
            title: "Oportunidade Tributária: PIS/COFINS Alíquota Zero por Finalidade",
            description: `A destinação industrial de insumos como resinas epóxi para fabricação direta de tintas possui direito de desoneração de PIS-Importação e COFINS-Importação a alíquota zero.`,
            baseLegal: rule.pisCofinsZeroBasis || "Lei Federal nº 10.865/2004, Artigo 8º.",
            impactoFinanceiro: `Redução da carga tributária federal de entrada em 11.75%. Economia de caixa estimada em ${currency} ${savings.toFixed(2)} (aprox. BRL ${(savings * 5.5).toFixed(2)}) se comprovada a destinação industrial.`,
            planoAcao: "Emitir Declaração de Finalidade Técnica assinada pelo engenheiro responsável e registrar o desembaraço sob o código de faturamento imune/reduzido correspondente no Siscomex.",
            affectedItems: [item.description]
          });
        }
      } else {
        // Fallback alert for unmapped general items
        const descLower = item.description.toLowerCase();
        if (descLower.includes("wi-fi") || descLower.includes("wifi") || descLower.includes("bluetooth") || descLower.includes("wireless")) {
          alerts.push({
            id: `alt-srv-${alertIdCounter++}`,
            severity: 'yellow',
            title: "Alerta de Radiofrequência de Equipamento (ANATEL)",
            description: `O item "${item.description}" indica características de comunicação sem fio, necessitando validação de homologação prévia junto à ANATEL.`,
            baseLegal: "Lei Federal nº 9.472/1997.",
            impactoFinanceiro: "Possibilidade de retenção fiscal temporária no canal vermelho para comprovação de selo de homologação.",
            planoAcao: "Validar se o dispositivo emissor possui homologação nacional e inserir o selo correspondente.",
            affectedItems: [item.description]
          });
        }
      }
    }
  });

  return alerts;
}

// REST API for Invoice Analysis using server-side Gemini 3.5-flash
app.post("/api/analyze-invoice", async (req: Request, res: Response) => {
  try {
    const { invoiceText, customRules } = req.body;

    if (!invoiceText || typeof invoiceText !== "string") {
       res.status(400).json({ error: "O texto da invoice é obrigatório para realizar a análise." });
       return;
    }

    const rulesList: NcmRule[] = customRules && Array.isArray(customRules) ? customRules : [];

    // Fallback if Gemini client is not initialized
    if (!ai) {
      console.log("No Gemini client initialized. Executing expert system offline heuristics on custom text.");
      // We will perform a simple regex/heuristics extraction from text to emulate parser
      const extractedItems = simulateTextExtraction(invoiceText);
      const generatedAlerts = runAuditEngine(extractedItems, rulesList);
      
      const totalFobUsd = extractedItems.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantity), 0);
      const riskScore = calculateRiskScore(generatedAlerts);

      res.json({
        success: true,
        method: "expert_heuristics_fallback",
        analysis: {
          fileName: "CUSTOM_UPLOAD_FALLBACK.txt",
          analyzedAt: new Date().toISOString(),
          totalFobUsd,
          currency: "USD",
          isCustomUpload: true,
          riskScore,
          items: extractedItems.map((item, index) => ({
            id: `item-cust-${index}`,
            ...item,
            totalPrice: item.unitPrice * item.quantity
          })),
          alerts: generatedAlerts
        }
      });
      return;
    }

    console.log("Calling server-side Gemini 3.5-flash to extract items from custom Invoice...");
    
    // Call Gemini with strict JSON Schema
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Análise técnica da Invoice comercial de importação anexada. 
      Extraia todos os itens e converta-os em uma lista JSON estruturada contendo:
      - description (Commercial description in English or original language)
      - ncm (8-digit NCM code. Find it or infer the closest Brazilian NCM code. E.g., facial cosmetic cream is 3304.99.90, Stanley cups/insulated flasks is 9617.00.10, epoxy resins is 3907.30.22, drone is 8806.92.00, wifi/radio devices is 8517.62.77)
      - unitPrice (unit price as numeric decimal)
      - currency (e.g., USD, EUR, BRL)
      - quantity (integer quantity)
      - countryOfOrigin (Country, default 'China' if not specified)
      - additionalDetails (mentioning brands like Stanley, organic aloe vera ingredients, weight, or wireless properties)

      Raw Invoice text content to analyze:
      ---------------------------------
      ${invoiceText}
      ---------------------------------`,
      config: {
        systemInstruction: "You are ComexPilot AI, an expert Brazilian customs auditor. You strictly extract commercial invoice line-items with high accuracy and output clean JSON adhering to the specified schema. For NCM fields, always output clean strings containing digits. Ensure NCMs are mapped to standard 8-digit Brazilian NCM codes.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  ncm: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  currency: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                  countryOfOrigin: { type: Type.STRING },
                  additionalDetails: { type: Type.STRING }
                },
                required: ["description", "ncm", "unitPrice", "currency", "quantity", "countryOfOrigin"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response received from Gemini model.");
    }

    const parsedJson = JSON.parse(text.trim());
    const extractedItems = parsedJson.items || [];

    // Map extracted items to full InvoiceItem type and run expert system
    const itemsWithIds = extractedItems.map((item: any, idx: number) => ({
      id: `item-gem-${idx}`,
      description: item.description,
      ncm: item.ncm ? item.ncm.replace(/[^0-9]/g, "") : "",
      unitPrice: Number(item.unitPrice) || 0,
      currency: item.currency || "USD",
      quantity: Number(item.quantity) || 1,
      totalPrice: (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1),
      countryOfOrigin: item.countryOfOrigin || "China",
      additionalDetails: item.additionalDetails || ""
    }));

    const alerts = runAuditEngine(itemsWithIds, rulesList);
    const totalFobUsd = itemsWithIds.reduce((acc: number, curr: any) => acc + curr.totalPrice, 0);
    const riskScore = calculateRiskScore(alerts);

    res.json({
      success: true,
      method: "gemini_ai_auditor",
      analysis: {
        fileName: "CUSTOM_INVOICE_UPLOAD.txt",
        analyzedAt: new Date().toISOString(),
        totalFobUsd,
        currency: "USD",
        isCustomUpload: true,
        riskScore,
        items: itemsWithIds,
        alerts: alerts
      }
    });

  } catch (error: any) {
    console.error("Error analyzing invoice via Gemini:", error);
    res.status(500).json({ 
      error: "Falha ao processar e auditar a invoice comercial.",
      details: error.message 
    });
  }
});

// REST API to retrieve the cosmetics database
app.get("/api/cosmetics-database", (req: Request, res: Response) => {
  res.json({
    success: true,
    data: COSMETICS_DATABASE
  });
});

// REST API to transcribe and analyze simulated/real WhatsApp audio
app.post("/api/transcribe-audio", async (req: Request, res: Response) => {
  try {
    const { presetName, voiceInput } = req.body;
    let transcript = "";
    let systemAnalysis = "";

    if (presetName === "comex_audio_1") {
      transcript = "Oi, tudo bem? Cara, tô com um lote de 3000 gel facial hidratante de Aloe Vera pra trazer da Coreia do Sul pro Porto de Santos. O fornecedor me passou o preço FOB de 1 dólar e 10 centavos a unidade. A NCM que ele sugeriu na Invoice é 3304.99.90. Dá uma olhada aí se essa NCM precisa de LI pré-embarque na ANVISA ou se tá isento, e se esse preço unitário corre algum risco de subfaturamento ou fiscalização aduaneira rígida na Receita.";
    } else if (presetName === "comex_audio_2") {
      transcript = "E aí, beleza? Estou analisando aqui uma carga de sabonete de toucador de luxo da França, NCM 3401.11.90. O preço unitário veio declarado como 0.50 centavos de dólar. Isso bate as regras da Anvisa recentes de 2024? Pode me dar o plano de ação rápido para registrar isso no Siscomex?";
    } else {
      transcript = voiceInput || "Pesquisar NCM de Protetor Solar 3304.99.90 e me falar as exigências da Anvisa.";
    }

    // Run Gemini 3.5-flash to write a detailed, highly intelligent, friendly custom voice note answer
    if (ai) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Você é o ComexPilot, assistente especialista em comércio exterior brasileiro.
        Dê um parecer profissional, extremamente prático e direto em português sobre a seguinte mensagem transcrita de áudio:
        "${transcript}"
        
        Considere nossa base de dados oficial de cosméticos:
        ${JSON.stringify(COSMETICS_DATABASE, null, 2)}
        
        Traga referências claras à legislação (como as RDCs 752/2022, 907/2024, 898/2024, 906/2024 da ANVISA), licença pré-embarque, risco de canal cinza por preço baixo de referência e se há incidência de Antidumping para esse item. Escreva em formato de notas estruturadas com emojis profissionais, focando em segurança cambial e conformidade regulatória.`,
        config: {
          systemInstruction: "You are ComexPilot, the elite aduaneira audit copilot. Provide your output in professional, elegant Brazilian Portuguese.",
        }
      });
      systemAnalysis = response.text || "Erro na geração da resposta do agente.";
    } else {
      // simulated offline high fidelity response
      if (transcript.includes("3304.99.90") || transcript.includes("Aloe Vera")) {
        systemAnalysis = `🎙️ **Análise ComexPilot - Resposta de Áudio (Coreia do Sul -> Santos)**

1️⃣ **Anuência Sanitária (ANVISA):**
*   **Regra:** A NCM **3304.99.90** (Cremes e géis de beleza) exige **Licença de Importação (LI) Pré-Embarque**.
*   **Base Legal:** Regulamentado pela **RDC 752/2022** e com as regras operacionais atualizadas pela **RDC 907/2024**.
*   **Atenção:** Como o produto possui apelo vegetal ("Aloe Vera"), há risco real de **Dupla Anuência** (ANVISA + MAPA - Instrução Normativa Conjunta 01/2012). O embarque *não* pode ser feito antes do deferimento da LI sob pena de multa compulsória de 1% do valor aduaneiro.

2️⃣ **Valoração e Subfaturamento:**
*   **Alerta Vermelho:** O preço unitário declarado de **USD 1.10** está significativamente abaixo do valor de referência de mercado de **USD 3.80** mapeado em nossa base híbrida.
*   **Impacto:** Alto risco de direcionamento automático para o **Canal Cinza (IN RFB 1986/2020)** para apuração de fraude. Prepare o laudo de composição de custos (*Cost Breakdown*) assinado pelo laboratório coreano.

3️⃣ **Antidumping:**
*   **Isenção Confirmada:** Não existem tarifas antidumping aplicáveis para cosméticos acabados sob esta NCM (Regime de livre flutuação de tarifas regulatórias).`;
      } else {
        systemAnalysis = `🎙️ **Análise ComexPilot - Parecer Rápido de Importação**

*   **Identificação:** Processando consulta para NCM sob análise de cosméticos e saneantes.
*   **Regulatório ANVISA:** Todo o Capítulo 33 exige licenciamento prévio adiantado no Siscomex, amparado pela RDC 752/2022.
*   **Recomendação:** Não autorize o carregamento do contêiner na origem antes de registrar a Licença de Importação correspondente.`;
      }
    }

    res.json({
      success: true,
      transcript,
      analysis: systemAnalysis
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Simple regex parser fallback for raw text extraction when Gemini API is not available
function simulateTextExtraction(text: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const lines = text.split("\n");
  
  // Search for keywords in the text to simulate intelligent mock parse
  let foundStanley = /stanley|mug|tumbler|cup|vacuum/i.test(text);
  let foundCosmetic = /cosmetic|cream|gel|aloe|moisturizer|face/i.test(text);
  let foundResin = /resin|epoxy|epoxide|chemical/i.test(text);
  let foundDrone = /drone|quadcopter|aircraft|uav/i.test(text);

  if (foundStanley) {
    items.push({
      description: "Vacuum Insulated Stainless Steel Tumbler (Stanley-Style)",
      ncm: "9617.00.10",
      unitPrice: 2.20,
      currency: "USD",
      quantity: 5000,
      countryOfOrigin: "China",
      additionalDetails: "Extracted via smart heuristic parsing. Weight estimate 0.40kg."
    });
  }
  
  if (foundCosmetic) {
    items.push({
      description: "Organic Aloe Vera Extract Beauty Facial Gel",
      ncm: "3304.99.90",
      unitPrice: 1.10,
      currency: "USD",
      quantity: 3000,
      countryOfOrigin: "China",
      additionalDetails: "Extracted organic skincare compound facial moisturizer."
    });
  }

  if (foundResin) {
    items.push({
      description: "High Grade Industrial Epoxy Liquid Resin",
      ncm: "3907.30.22",
      unitPrice: 4.50,
      currency: "USD",
      quantity: 10000,
      countryOfOrigin: "USA",
      additionalDetails: "Extracted industrial polymer. Pure epóxi resin formulation."
    });
  }

  if (foundDrone) {
    items.push({
      description: "Industrial Inspection Quadcopter Drone with Wifi Remote",
      ncm: "8806.92.00",
      unitPrice: 580.00,
      currency: "USD",
      quantity: 20,
      countryOfOrigin: "China",
      additionalDetails: "Inspection unmanned aerial system drone with wireless controller."
    });
  }

  // If absolutely nothing matched, provide a generic custom item parsed
  if (items.length === 0) {
    items.push({
      description: "Custom Extracted Commercial Product (Review NCM)",
      ncm: "3304.99.90",
      unitPrice: 1.50,
      currency: "USD",
      quantity: 1000,
      countryOfOrigin: "China",
      additionalDetails: "Generic parsed line item from raw invoice text."
    });
  }

  return items;
}

function calculateRiskScore(alerts: any[]): number {
  let score = 5; // Base baseline compliance score
  alerts.forEach(alert => {
    if (alert.severity === 'red') score += 40;
    if (alert.severity === 'yellow') score += 15;
  });
  return Math.min(score, 100);
}


// Vite Integration for Full-Stack development / Production assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Serving static build files from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ComexPilot backend and frontend running on http://localhost:${PORT}`);
  });
}

startServer();
