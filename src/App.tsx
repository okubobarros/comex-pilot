/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  FileText, 
  Sliders, 
  HelpCircle, 
  Info, 
  Scale, 
  DollarSign, 
  Briefcase, 
  RefreshCw, 
  Layers, 
  Sparkles,
  BookOpen,
  Check,
  AlertCircle,
  Search,
  Download,
  Upload,
  Play,
  Square,
  User,
  FileCode,
  MapPin,
  Activity,
  Phone,
  MessageSquare,
  ChevronRight,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { InvoiceItem, AuditAlert, InvoiceAnalysis, NcmRule } from './types';
import { DEFAULT_NCM_RULES, PRESET_SCENARIOS } from './data/mockScenarios';
import { COSMETICS_DATABASE, CosmeticNcmInfo } from './data/cosmeticsDb';

// Custom interface for Container Lot / Carga item in the prioritized feed
interface CargoLot {
  id: string;
  name: string;
  containerId: string;
  country: string;
  flag: string;
  riskClass: 'high' | 'medium' | 'low';
  financialRiskValue: number;
  product: string;
  ncm: string;
  invoiceVal: number;
  qty: number;
  origin: string;
  alerts: {
    id: string;
    severity: 'red' | 'yellow' | 'green';
    type: 'LI_ANVISA' | 'SUBFATURAMENTO' | 'ANTIDUMPING' | 'MAPA_CONFLICT' | 'ANATEL_HOMOLOG' | 'EX_TARIFARIO' | 'PIS_COFINS';
    title: string;
    desc: string;
    legal: string;
    action: string;
  }[];
}

export default function App() {
  // Application State
  const [activeScenario, setActiveScenario] = useState<InvoiceAnalysis>(PRESET_SCENARIOS[0]);
  const [customRules, setCustomRules] = useState<NcmRule[]>(DEFAULT_NCM_RULES);
  const [invoiceText, setInvoiceText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [aiStatus, setAiStatus] = useState<'idle' | 'success' | 'simulated'>('success');
  
  // Concierge Search State
  const [searchQuery, setSearchQuery] = useState<string>('protetor solar');
  const [selectedConciergeItem, setSelectedConciergeItem] = useState<CosmeticNcmInfo | null>(
    COSMETICS_DATABASE.find(c => c.ncm === '3304.99.90') || COSMETICS_DATABASE[0]
  );

  // Drag and Drop Simulator State
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [draggedFile, setDraggedFile] = useState<string | null>(null);

  // WhatsApp Voice State
  const [selectedAudioPreset, setSelectedAudioPreset] = useState<'comex_audio_1' | 'comex_audio_2'>('comex_audio_1');
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioTranscription, setAudioTranscription] = useState<string>('');
  const [audioVerdict, setAudioVerdict] = useState<string>('');
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // LI Minuta Modal State
  const [isLiModalOpen, setIsLiModalOpen] = useState<boolean>(false);
  const [liPrefilledData, setLiPrefilledData] = useState<{
    lotId?: string;
    ncm: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    origin: string;
    legalRule: string;
    exporter: string;
    manufacturer: string;
  } | null>(null);

  const [liExporterName, setLiExporterName] = useState<string>('Seoul Beauty Laboratory Co.');
  const [liManufacturerName, setLiManufacturerName] = useState<string>('S-Cosmetics Bio Factory Ltd.');
  const [isSignedWithCpf, setIsSignedWithCpf] = useState<boolean>(false);
  const [cpfNumber, setCpfNumber] = useState<string>('442.901.884-02');
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Static prioritized cargo database matching user workflows
  const CARGO_LOTS_FEED: CargoLot[] = [
    {
      id: 'LOTE-88402',
      name: 'Lote #88402 (Coreia do Sul)',
      containerId: 'CNTR-KOR-55902',
      country: 'Coreia do Sul',
      flag: '🇰🇷',
      riskClass: 'high',
      financialRiskValue: 44500.00,
      product: 'Organic Aloe Vera Hydrating Facial Gel (Estética)',
      ncm: '3304.99.90',
      invoiceVal: 3300.00,
      qty: 3000,
      origin: 'Coreia do Sul',
      alerts: [
        {
          id: 'alt-88402-1',
          severity: 'red',
          type: 'LI_ANVISA',
          title: 'Exigência de Anuência Prévia (ANVISA) - LI antes do Embarque',
          desc: 'A importação deste cosmético hidratante exige Licença de Importação (LI) autorizada pela ANVISA de forma prévia ao embarque físico do exterior.',
          legal: 'RDC nº 752/2022 e RDC nº 907/2024 da ANVISA.',
          action: 'Deferir a Licença de Importação no Siscomex antes da data de emissão do Bill of Lading (B/L) para evitar multa pecuniária aduaneira.'
        },
        {
          id: 'alt-88402-2',
          severity: 'red',
          type: 'SUBFATURAMENTO',
          title: 'Risco Crítico de Subfaturamento (Canal Cinza - RFB)',
          desc: 'O preço unitário declarado de USD 1.10 está significativamente abaixo do preço de referência de mercado de USD 3.80 estipulado em nossa base histórica.',
          legal: 'Instrução Normativa RFB nº 1986/2020 e Art. 86 da MP nº 2.158-35/2001.',
          action: 'Providenciar o fluxograma detalhado de custos (cost breakdown) original e comprovantes Swift de remessa financeira.'
        },
        {
          id: 'alt-88402-3',
          severity: 'yellow',
          type: 'MAPA_CONFLICT',
          title: 'Conflito Regulatório ANVISA vs. MAPA (Dupla Anuência)',
          desc: 'A descrição comercial cita extrato vegetal ("Aloe Vera") e termo "Organic". Risco elevado de duplo controle da ANVISA e do MAPA.',
          legal: 'Instrução Normativa Conjunta MAPA/ANVISA nº 01/2012.',
          action: 'Apresentar laudo técnico que declare a purificação de grau cosmético e inércia vegetal.'
        }
      ]
    },
    {
      id: 'LOTE-90241',
      name: 'Lote #90241 (China)',
      containerId: 'CNTR-CHN-88401',
      country: 'China',
      flag: '🇨🇳',
      riskClass: 'high',
      financialRiskValue: 112500.00,
      product: 'Vacuum Insulated Stainless Steel Tumbler (Stanley-Style)',
      ncm: '9617.00.10',
      invoiceVal: 11000.00,
      qty: 5000,
      origin: 'China',
      alerts: [
        {
          id: 'alt-90241-1',
          severity: 'red',
          type: 'ANTIDUMPING',
          title: 'Aplicação de Direitos Antidumping Ativos - Resolução GECEX',
          desc: 'Garrafas térmicas inoxidáveis com vácuo vindas da China possuem incidência compensatória direta de USD 4.10 por kg líquido de carga.',
          legal: 'Resolução GECEX nº 227/2021 (Recipientes térmicos de aço inox).',
          action: 'Provisionar recolhimento compulsório do imposto antidumping de importação ou reavaliar origem.'
        },
        {
          id: 'alt-90241-2',
          severity: 'yellow',
          type: 'SUBFATURAMENTO',
          title: 'Controle de Valoração por Marca Registrada (Marcas de Alto Risco)',
          desc: 'A mercadoria cita marca Stanley. Monitoramento rigoroso do setor de combate à pirataria e contrafação aduaneira no porto.',
          legal: 'Artigos 190 a 195 da Lei Federal de Propriedade Industrial nº 9.279/1996.',
          action: 'Apresentar laudo original de autorização de marca de importador brasileiro assinado pela detentora.'
        }
      ]
    },
    {
      id: 'LOTE-77312',
      name: 'Lote #77312 (Estados Unidos)',
      containerId: 'CNTR-USA-44102',
      country: 'Estados Unidos',
      flag: '🇺🇸',
      riskClass: 'low',
      financialRiskValue: -28600.00, // Negative risk value represents savings
      product: 'High Grade Industrial Epoxy Liquid Resin EP-44',
      ncm: '3907.30.22',
      invoiceVal: 45000.00,
      qty: 10000,
      origin: 'Estados Unidos',
      alerts: [
        {
          id: 'alt-77312-1',
          severity: 'green',
          type: 'EX_TARIFARIO',
          title: 'Oportunidade Tributária: Redução de II via Ex-Tarifário Ativo',
          desc: 'A NCM possui o benefício do Ex-Tarifário ativo, reduzindo o Imposto de Importação padrão de 14% para 0% no Siscomex.',
          legal: 'Regime de Ex-Tarifário para fomento de bens de capital e insumos industriais.',
          action: 'Especificar as características mecânicas e químicas correspondentes exatas no texto da Declaração de Importação.'
        },
        {
          id: 'alt-77312-2',
          severity: 'green',
          type: 'PIS_COFINS',
          title: 'Oportunidade: Desoneração de PIS/COFINS-Importação por Finalidade',
          desc: 'Isenção total das contribuições federais de entrada se o insumo for destinado à fabricação de tintas protetivas industriais.',
          legal: 'Lei Federal nº 10.865/2004, Artigo 8º, § 11.',
          action: 'Anexar laudo de destinação industrial assinado pelo químico responsável da empresa.'
        }
      ]
    },
    {
      id: 'LOTE-60211',
      name: 'Lote #60211 (Alemanha)',
      containerId: 'CNTR-DEU-11902',
      country: 'Alemanha',
      flag: '🇩🇪',
      riskClass: 'medium',
      financialRiskValue: 12500.00,
      product: 'Industrial Inspection Drone with Wi-Fi RF module',
      ncm: '8806.92.00',
      invoiceVal: 11600.00,
      qty: 20,
      origin: 'Alemanha',
      alerts: [
        {
          id: 'alt-60211-1',
          severity: 'yellow',
          type: 'ANATEL_HOMOLOG',
          title: 'Exigência de Homologação de Telecomunicações (ANATEL)',
          desc: 'Aeronave não tripulada com transmissor Wi-Fi integrado requer comprovação de homologação técnica ativa da ANATEL.',
          legal: 'Lei Geral de Telecomunicações nº 9.472/1997 e Resolução ANATEL nº 715/2019.',
          action: 'Informar o número do selo de homologação ANATEL correspondente nas observações aduaneiras.'
        }
      ]
    }
  ];

  // Run initial state calculation
  useEffect(() => {
    recalculateActiveScenario();
  }, [customRules]);

  const recalculateActiveScenario = () => {
    const updatedAlerts: AuditAlert[] = [];
    let alertIdCounter = 9000;
    const items = activeScenario.items;

    items.forEach((item) => {
      const cleanItemNcm = (item.ncm || "").replace(/[^0-9]/g, "");
      
      const rule = customRules.find(r => {
        const cleanRuleNcm = r.ncm.replace(/[^0-9]/g, "");
        return cleanItemNcm.startsWith(cleanRuleNcm) || cleanRuleNcm.startsWith(cleanItemNcm);
      });

      if (rule) {
        const currency = item.currency || "USD";
        const unitPrice = Number(item.unitPrice) || 0;
        const quantity = Number(item.quantity) || 1;
        const totalItemPrice = unitPrice * quantity;

        // 1. RED ALERT - SUBFATURAMENTO (Canal Cinza)
        if (unitPrice < rule.minReferencePrice) {
          const diffUsd = (rule.minReferencePrice - unitPrice) * quantity;
          updatedAlerts.push({
            id: `alt-cli-${alertIdCounter++}`,
            severity: 'red',
            title: `Risco de Subfaturamento (Canal Cinza) - NCM ${rule.ncm}`,
            description: `O preço unitário de ${currency} ${unitPrice.toFixed(2)} para "${item.description}" está abaixo do preço de referência aduaneiro de ${currency} ${rule.minReferencePrice.toFixed(2)}.`,
            baseLegal: "Instrução Normativa RFB nº 1986/2020 (Procedimento Especial de Fiscalização de Combate à Fraude Aduaneira) e Art. 86 da MP nº 2.158-35/2001.",
            impactoFinanceiro: `Instauração de canal cinza com retenção da carga por até 90 dias para valoração. Risco de arbitramento tributário e multa punitiva de 100% sobre a diferença de valor calculada em USD ${diffUsd.toFixed(2)} (aprox. R$ ${(diffUsd * 5.5).toFixed(2)}).`,
            planoAcao: "Obter com urgência o 'Cost Breakdown' original do fabricante na China, comprovante Swift de remessa financeira total e a Declaração de Exportação (D.E.) do país de origem.",
            affectedItems: [item.description]
          });
        }

        // 2. RED ALERT - ANTIDUMPING
        if (rule.isAntidumpingActive && (item.countryOfOrigin || "").toLowerCase().includes("china")) {
          const weightKg = quantity * 0.4; // estimated weight per unit
          const antidumpingFee = (rule.antidumpingFeeKgUsd || 4.10) * weightKg;
          updatedAlerts.push({
            id: `alt-cli-${alertIdCounter++}`,
            severity: 'red',
            title: `Aplicação de Direitos Antidumping Ativos - NCM ${rule.ncm}`,
            description: `O item "${item.description}" originário da China está sujeito à sobretaxa antidumping compulsória vigente na alfândega brasileira.`,
            baseLegal: `Resolução GECEX nº 227/2021 (Recipientes térmicos de aço inox).`,
            impactoFinanceiro: `Cobrança de encargo compensatório de USD ${antidumpingFee.toFixed(2)} (aprox. R$ ${(antidumpingFee * 5.5).toFixed(2)}) com base na alíquota de USD ${rule.antidumpingFeeKgUsd?.toFixed(2) || '4.10'}/kg sobre o peso líquido total da carga.`,
            planoAcao: "Provisionar o pagamento extra do imposto antidumping no registro da DI/Duimp, ou homologar produtores alternativos em países isentos.",
            affectedItems: [item.description]
          });
        }

        // 3. RED ALERT - ANUÊNCIA PRÉVIA (ANVISA)
        if (rule.requiresAnvisa) {
          updatedAlerts.push({
            id: `alt-cli-${alertIdCounter++}`,
            severity: 'red',
            title: `Anuência Prévia Obrigatória (ANVISA) - NCM ${rule.ncm}`,
            description: `A NCM do produto "${item.description}" exige Licença de Importação (LI) autorizada pela ANVISA de forma prévia ao embarque físico do exterior.`,
            baseLegal: "RDC nº 752/2022 ANVISA e Portaria SECEX nº 23/2011.",
            impactoFinanceiro: "Multa pecuniária automática de 1% do valor aduaneiro (mínimo de R$ 500,00) por embarcar sem LI aprovada na origem, além de potencial obrigação de reexportar o lote.",
            planoAcao: "Protocolar e deferir o pedido de LI no Siscomex antes da data de emissão do Bill of Lading (B/L) no exterior.",
            affectedItems: [item.description]
          });
        }

        // 4. YELLOW ALERT - CONFLITO ANVISA vs MAPA
        if (rule.checkMapaConflict) {
          const descLower = item.description.toLowerCase();
          const hasIngredients = ["aloe", "organic", "plant", "vegetal", "chamomile", "extract", "natural", "oil", "beeswax", "honey", "animal"].some(kw => descLower.includes(kw));
          if (hasIngredients) {
            updatedAlerts.push({
              id: `alt-cli-${alertIdCounter++}`,
              severity: 'yellow',
              title: "Risco de Conflito de Competência ANVISA vs. MAPA",
              description: `A descrição comercial de "${item.description}" menciona compostos de origem vegetal ou orgânica, o que frequentemente gera conflito de fiscalização e exigência de dupla anuência (Saúde + Agricultura).`,
              baseLegal: "Instrução Normativa Conjunta MAPA/ANVISA nº 01/2012 e Decreto nº 4.412/2002.",
              impactoFinanceiro: "Atraso estimado de 30 a 45 dias no desembaraço aduaneiro portuário para emissão de parecer do MAPA, gerando custos adicionais de armazenagem e demurrage superiores a R$ 15.000,00.",
              planoAcao: "Apresentar laudo técnico do fabricante comprovando que as matérias-primas vegetais passaram por processo químico de purificação e sintetização de grau puramente cosmético.",
              affectedItems: [item.description]
            });
          }
        }

        // 5. YELLOW ALERT - MARCAS DE ALTO RISCO / STANLEY
        const descLowerBrand = item.description.toLowerCase();
        const hasBrand = ["stanley", "apple", "nike", "samsung", "yeti", "brand"].some(kw => descLowerBrand.includes(kw));
        if (hasBrand || (rule.ncm === "9617.00.10" && descLowerBrand.includes("stanley"))) {
          updatedAlerts.push({
            id: `alt-cli-${alertIdCounter++}`,
            severity: 'yellow',
            title: `Controle Antipirataria de Marca Registrada - NCM ${rule.ncm}`,
            description: `A mercadoria "${item.description}" ostenta marca de alta reputação, monitorada prioritariamente pelo setor de combate à contrafação aduaneira.`,
            baseLegal: "Artigos 190 a 195 da Lei Federal de Propriedade Industrial (Lei nº 9.279/1996) e Art. 605 do Regulamento Aduaneiro.",
            impactoFinanceiro: "Retenção física no canal vermelho para vistoria e coleta de amostras. Caso seja confirmada pirataria, o lote integral de mercadorias é apreendido para destruição oficial, com denúncia-crime contra o importador.",
            planoAcao: "Apresentar a autorização de comercialização (Brand License/Consent Certificate) emitida diretamente pelo titular da marca registrada no Brasil.",
            affectedItems: [item.description]
          });
        }

        // 6. YELLOW ALERT - HOMOLOGAÇÃO ANATEL
        if (rule.requiresAnatel || descLowerBrand.includes("wi-fi") || descLowerBrand.includes("wifi") || descLowerBrand.includes("bluetooth") || descLowerBrand.includes("remote")) {
          updatedAlerts.push({
            id: `alt-cli-${alertIdCounter++}`,
            severity: 'yellow',
            title: `Exigência de Homologação ANATEL (Emissor de Rádio) - NCM ${rule.ncm}`,
            description: `O item "${item.description}" possui tecnologia sem fio (transmissor RF), o que obriga a apresentação do certificado de homologação da ANATEL antes da liberação aduaneira.`,
            baseLegal: "Lei Geral de Telecomunicações nº 9.472/1997 e Resolução nº 715/2019 da ANATEL.",
            impactoFinanceiro: "Bloqueio de importação e retenção na alfândega do aeroporto. Custo para homologação por OCD estimado em R$ 10.000,00 por família de equipamento eletrônico.",
            planoAcao: "Verificar se o transmissor de rádio embutido já possui homologação homologada ativa no Brasil por parte do fornecedor, anexando o código oficial de barras do Siscomex.",
            affectedItems: [item.description]
          });
        }

        // 7. GREEN ALERT - EX-TARIFÁRIO
        if (rule.hasExTarifario) {
          const savings = (rule.standardIiRate - (rule.exTarifarioRate || 0)) / 100 * totalItemPrice;
          updatedAlerts.push({
            id: `alt-cli-${alertIdCounter++}`,
            severity: 'green',
            title: `Oportunidade: Redução de II via Ex-Tarifário Ativo - NCM ${rule.ncm}`,
            description: `A NCM ${rule.ncm} possui o benefício do Ex-Tarifário nº 002 ativo, reduzindo o Imposto de Importação padrão de ${rule.standardIiRate}% para ${rule.exTarifarioRate || 0}%.`,
            baseLegal: "Regime de Ex-Tarifário para fomento de bens de capital e insumos industriais.",
            impactoFinanceiro: `Economia tributária de II direta no desembaraço estimada em USD ${savings.toFixed(2)} (cerca de R$ ${(savings * 5.5).toFixed(2)}) de desembolso financeiro aduaneiro.`,
            planoAcao: "Fazer constar na descrição da adição da DI o enquadramento perfeito das especificações físico-químicas ou mecânicas exigidas no texto do decreto outorgante.",
            affectedItems: [item.description]
          });
        }

        // 8. GREEN ALERT - PIS/COFINS ZERO POR FINALIDADE
        if (rule.hasPisCofinsZeroOpportunity) {
          const savings = 0.1175 * totalItemPrice;
          updatedAlerts.push({
            id: `alt-cli-${alertIdCounter++}`,
            severity: 'green',
            title: `Oportunidade: Desoneração de PIS/COFINS por Finalidade - NCM ${rule.ncm}`,
            description: `A aplicação desta resina para a fabricação direta de tintas protetivas industriais garante isenção/alíquota zero das contribuições sociais federais de entrada.`,
            baseLegal: rule.pisCofinsZeroBasis || "Lei Federal nº 10.865/2004, Artigo 8º, § 11.",
            impactoFinanceiro: `Economia de 11.75% sobre a base tributária federal de PIS/COFINS-Importação, resultando em USD ${savings.toFixed(2)} (cerca de R$ ${(savings * 5.5).toFixed(2)}) de caixa otimizado.`,
            planoAcao: "Elaborar laudo de destinação assinado pelo engenheiro industrial do importador e declarar a finalidade correspondente no registro da DI.",
            affectedItems: [item.description]
          });
        }
      }
    });

    let score = 5;
    updatedAlerts.forEach(a => {
      if (a.severity === 'red') score += 35;
      if (a.severity === 'yellow') score += 12;
    });
    const finalScore = Math.min(score, 100);

    setActiveScenario(prev => ({
      ...prev,
      alerts: updatedAlerts,
      riskScore: finalScore
    }));
  };

  // Drag and Drop Simulator Functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setDraggedFile(file.name);
      
      // Simulate reading and loading file
      if (file.name.toLowerCase().includes('amour') || file.name.toLowerCase().includes('cosmetic')) {
        setActiveScenario(PRESET_SCENARIOS[0]);
      } else if (file.name.toLowerCase().includes('stanley') || file.name.toLowerCase().includes('mug')) {
        setActiveScenario(PRESET_SCENARIOS[1]);
      } else if (file.name.toLowerCase().includes('epoxy') || file.name.toLowerCase().includes('resin')) {
        setActiveScenario(PRESET_SCENARIOS[2]);
      } else {
        setActiveScenario(PRESET_SCENARIOS[0]);
      }
      setErrorMsg(null);
    }
  };

  const handleSimulateLocalFile = (fileName: string, presetIndex: number) => {
    setDraggedFile(fileName);
    setActiveScenario(PRESET_SCENARIOS[presetIndex]);
    setErrorMsg(null);
  };

  // Handler to analyze custom text input via Express Backend & Gemini
  const handleAnalyzeCustomInvoice = async () => {
    if (!invoiceText.trim()) {
      setErrorMsg('Por favor, cole o texto comercial da sua Invoice ou selecione um cenário pré-carregado.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/analyze-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceText: invoiceText,
          customRules: customRules
        })
      });

      if (!response.ok) {
        throw new Error('Ocorreu uma falha na comunicação com o servidor aduaneiro.');
      }

      const data = await response.json();
      if (data.success && data.analysis) {
        setActiveScenario(data.analysis);
        setAiStatus(data.method === 'gemini_ai_auditor' ? 'success' : 'simulated');
      } else {
        throw new Error(data.error || 'Não foi possível extrair os itens da Invoice.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Erro na análise: ${err.message}. Executando auditoria offline baseada em heurísticas.`);
      simulateHeuristicAnalysis(invoiceText);
    } finally {
      setIsLoading(false);
    }
  };

  // Local fallback parsing when backend / AI fails
  const simulateHeuristicAnalysis = (text: string) => {
    let foundStanley = /stanley|mug|tumbler|cup|vacuum/i.test(text);
    let foundCosmetic = /cosmetic|cream|gel|aloe|moisturizer|face/i.test(text);
    let foundResin = /resin|epoxy|epoxide|chemical/i.test(text);
    let foundDrone = /drone|quadcopter|aircraft|uav/i.test(text);

    const items: InvoiceItem[] = [];
    if (foundStanley) {
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
    if (foundCosmetic) {
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
    if (foundResin) {
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
    if (foundDrone) {
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

    const mockAnalysis: InvoiceAnalysis = {
      fileName: 'PASTE_INVOICE_AUDIT.txt',
      analyzedAt: new Date().toISOString(),
      items: items,
      alerts: [],
      riskScore: 20,
      totalFobUsd: items.reduce((acc, c) => acc + c.totalPrice, 0),
      currency: 'USD',
      isCustomUpload: true
    };

    const alertsList: AuditAlert[] = [];
    let alertIdCounter = 9500;
    items.forEach((item) => {
      const rule = customRules.find(r => r.ncm === item.ncm);
      if (rule) {
        if (item.unitPrice < rule.minReferencePrice) {
          alertsList.push({
            id: `alt-heur-${alertIdCounter++}`,
            severity: 'red',
            title: `Risco de Subfaturamento (Canal Cinza) - NCM ${rule.ncm}`,
            description: `Preço unitário de USD ${item.unitPrice.toFixed(2)} está abaixo do mínimo de referência de USD ${rule.minReferencePrice.toFixed(2)}.`,
            baseLegal: "IN RFB nº 1986/2020.",
            impactoFinanceiro: `Risco de retenção aduaneira por até 90 dias e arbitramento fiscal de valor com multa de 100%.`,
            planoAcao: "Apresentar Cost Breakdown de produção e SWIFT bancário comprovante de pagamento.",
            affectedItems: [item.description]
          });
        }
        if (rule.isAntidumpingActive && item.countryOfOrigin.toLowerCase().includes('china')) {
          alertsList.push({
            id: `alt-heur-${alertIdCounter++}`,
            severity: 'red',
            title: `Direitos Antidumping Ativos - NCM ${rule.ncm}`,
            description: `Recipiente térmico inoxidável sujeito à sobretaxa antidumping originária da China.`,
            baseLegal: "Resolução GECEX nº 227/2021.",
            impactoFinanceiro: "Tarifa adicional compulsória de USD 4.10 por kg líquido de produto.",
            planoAcao: "Provisionar recolhimento antecipado do encargo antidumping na DI.",
            affectedItems: [item.description]
          });
        }
        if (rule.requiresAnvisa) {
          alertsList.push({
            id: `alt-heur-${alertIdCounter++}`,
            severity: 'red',
            title: `Anuência Prévia Obrigatória (ANVISA) - NCM ${rule.ncm}`,
            description: `Produto sujeito à fiscalização e deferimento prévio de LI da ANVISA antes do embarque.`,
            baseLegal: "RDC nº 752/2022 ANVISA.",
            impactoFinanceiro: "Multa de 1% do valor aduaneiro em caso de embarque sem LI deferida.",
            planoAcao: "Deferir a Licença de Importação antes da saída de porto estrangeiro.",
            affectedItems: [item.description]
          });
        }
      }
    });

    let score = 5;
    alertsList.forEach(a => {
      if (a.severity === 'red') score += 40;
    });

    mockAnalysis.alerts = alertsList;
    mockAnalysis.riskScore = Math.min(score, 100);

    setActiveScenario(mockAnalysis);
    setAiStatus('simulated');
  };

  // WhatsApp Voice note trigger function
  const triggerVoiceAnalysis = async () => {
    setIsAudioLoading(true);
    setAudioTranscription('');
    setAudioVerdict('');
    setIsAudioPlaying(true);

    let progress = 0;
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);

    audioIntervalRef.current = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
        setIsAudioPlaying(false);
        callAudioTranscribeApi();
      }
    }, 200);
  };

  const callAudioTranscribeApi = async () => {
    try {
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetName: selectedAudioPreset
        })
      });

      if (!response.ok) {
        throw new Error('Falha no processador de voz aduaneiro.');
      }

      const data = await response.json();
      if (data.success) {
        setAudioTranscription(data.transcript);
        setAudioVerdict(data.analysis);
      }
    } catch (err: any) {
      console.error(err);
      setAudioTranscription("Erro ao conectar.");
      setAudioVerdict("Falha operacional.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  // Concierge Interactive Search Function
  const handleConciergeSearch = (term: string) => {
    setSearchQuery(term);
    if (!term.trim()) return;

    // Search inside COSMETICS_DATABASE by description or NCM
    const cleanTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = COSMETICS_DATABASE.find(item => {
      const cleanNcm = item.ncm.replace(/[^0-9]/g, '');
      const descLower = item.description.toLowerCase();
      return cleanNcm.includes(cleanTerm) || descLower.includes(term.toLowerCase());
    });

    if (found) {
      setSelectedConciergeItem(found);
    }
  };

  // LI Prefill trigger function
  const openLiMinutaForCargo = (cargo: CargoLot) => {
    const mainAlert = cargo.alerts.find(a => a.type === 'LI_ANVISA') || cargo.alerts[0];
    
    setLiPrefilledData({
      lotId: cargo.id,
      ncm: cargo.ncm,
      description: cargo.product,
      quantity: cargo.qty,
      unitPrice: cargo.invoiceVal / cargo.qty,
      totalPrice: cargo.invoiceVal,
      origin: cargo.origin,
      legalRule: mainAlert?.legal || 'RDC 752/2022',
      exporter: 'Seoul Beauty Laboratory Co.',
      manufacturer: 'S-Cosmetics Bio Factory Ltd.'
    });

    setLiExporterName('Seoul Beauty Laboratory Co.');
    setLiManufacturerName('S-Cosmetics Bio Factory Ltd.');
    setIsSignedWithCpf(false);
    setCpfError(null);
    setIsLiModalOpen(true);
  };

  const openLiMinutaForActiveItem = (item: InvoiceItem) => {
    setLiPrefilledData({
      ncm: item.ncm,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      origin: item.countryOfOrigin,
      legalRule: 'RDC 752/2022 ANVISA (Controle Sanitário de Importação)',
      exporter: 'Global Export Partners Corp.',
      manufacturer: 'Asian Bio-Chemical Industry Ltd.'
    });

    setLiExporterName('Global Export Partners Corp.');
    setLiManufacturerName('Asian Bio-Chemical Industry Ltd.');
    setIsSignedWithCpf(false);
    setCpfError(null);
    setIsLiModalOpen(true);
  };

  // Download functional XML files
  const handleExportXml = () => {
    if (isSignedWithCpf && !cpfNumber.trim()) {
      setCpfError('Obrigatório preencher CPF para a assinatura eletrônica ICP-Brasil.');
      return;
    }
    setCpfError(null);
    setIsExporting(true);

    setTimeout(() => {
      setIsExporting(false);
      if (!liPrefilledData) return;

      const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<SiscomexImportacao versao="2.0">
  <LicencaImportacao>
    <IdentificacaoCarga>
      <DescricaoComercial>${liPrefilledData.description}</DescricaoComercial>
      <Ncm>${liPrefilledData.ncm}</Ncm>
      <OrigemMercadoria>${liPrefilledData.origin}</OrigemMercadoria>
      <Quantidade>${liPrefilledData.quantity}</Quantidade>
      <Moeda>USD</Moeda>
      <ValorFob>${liPrefilledData.totalPrice.toFixed(2)}</ValorFob>
    </IdentificacaoCarga>
    <DadosExportador>
      <NomeRazao>${liExporterName}</NomeRazao>
      <Fabricante>${liManufacturerName}</Fabricante>
    </DadosExportador>
    <EnquadramentoLegal>
      <OrgaoAnuente>ANVISA</OrgaoAnuente>
      <NormativaReguladora>${liPrefilledData.legalRule}</NormativaReguladora>
      <RequisitosTecnicos>Regulamento de Cosméticos Capitulo 33</RequisitosTecnicos>
    </EnquadramentoLegal>
    <AssinaturaEletronica>
      <Metodo>ICP-Brasil Digital Signature Token</Metodo>
      <CPF>${isSignedWithCpf ? cpfNumber : "NAO_ASSINADO"}</CPF>
      <Status>${isSignedWithCpf ? "HOMOLOGADO_CPF_ATIVO" : "PENDENTE_ASSINATURA"}</Status>
      <DataGeracao>${new Date().toISOString()}</DataGeracao>
    </AssinaturaEletronica>
  </LicencaImportacao>
</SiscomexImportacao>`;

      // Generate actual download
      const blob = new Blob([xmlTemplate], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `siscomex_li_${liPrefilledData.ncm.replace(/\./g, '')}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 800);
  };

  // Download responsability term
  const handleExportTermoResponsabilidade = () => {
    if (isSignedWithCpf && !cpfNumber.trim()) {
      setCpfError('Obrigatório informar CPF ativo para assinar o Termo de Responsabilidade.');
      return;
    }
    setCpfError(null);
    setIsExporting(true);

    setTimeout(() => {
      setIsExporting(false);
      if (!liPrefilledData) return;

      const docText = `TERMO DE COMPROMISSO E RESPONSABILIDADE ADUANEIRA - ANVISA / RECEITA FEDERAL

Pelo presente instrumento, declaramos para os devidos fins de direito, sob as penas da lei (Art. 299 do Código Penal Brasileiro), que as mercadorias descritas abaixo estão em perfeito acordo com as normas técnico-sanitárias vigentes no Brasil, especialmente as regras de Vigilância Sanitária relativas a Cosméticos (RDC 752/2022).

DADOS DO PRODUTO SOB ANALISE ADUANEIRA:
- Descrição Comercial: ${liPrefilledData.description}
- Nomenclatura Comum do Mercosul (NCM): ${liPrefilledData.ncm}
- Quantidade Lote: ${liPrefilledData.quantity} Unidades
- Valor Total FOB Declarado: USD ${liPrefilledData.totalPrice.toFixed(2)}
- País de Origem de Produção: ${liPrefilledData.origin}

DADOS ADICIONAIS DO PROCESSO:
- Exportador Internacional: ${liExporterName}
- Fabricante de Origem: ${liManufacturerName}
- Normativa Reguladora Ancorada: ${liPrefilledData.legalRule}

ASSINATURA DIGITAL ICP-BRASIL:
- Assinado eletronicamente por Responsável Técnico Aduaneiro
- CPF do Signatário: ${isSignedWithCpf ? cpfNumber : "Sem assinatura digital vinculada"}
- Hash de Validação Eletrônica: SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}
- Data de Validação do Protocolo: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}

Este termo é integrado digitalmente ao dossiê de Licença de Importação do Siscomex para triagem fiscal preventiva.`;

      const blob = new Blob([docText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `termo_responsabilidade_anvisa_${liPrefilledData.ncm.replace(/\./g, '')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 800);
  };

  // Helper formatting
  const formatCurrency = (val: number, curr: string = 'USD') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: curr
    }).format(val);
  };

  const getRiskBadgeColor = (score: number) => {
    if (score >= 70) return 'bg-rose-100 text-rose-800 border-rose-300';
    if (score >= 30) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'Risco Alto';
    if (score >= 30) return 'Risco Médio';
    return 'Risco Baixo';
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'red':
        return {
          bg: 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/30',
          border: 'border-l-4 border-l-rose-500',
          badge: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: <ShieldAlert className="w-4 h-4 text-rose-600" />,
          label: 'CRÍTICO'
        };
      case 'yellow':
        return {
          bg: 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/30',
          border: 'border-l-4 border-l-amber-500',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          label: 'ATENÇÃO'
        };
      case 'green':
        return {
          bg: 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/30',
          border: 'border-l-4 border-l-emerald-500',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
          label: 'OPORTUNIDADE'
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200',
          border: 'border-l-4 border-l-slate-400',
          badge: 'bg-slate-100 text-slate-800',
          icon: <Info className="w-4 h-4 text-slate-500" />,
          label: 'REGULAR'
        };
    }
  };

  // Filter active alerts by tab
  const filteredAlerts = activeScenario.alerts.filter((alert) => {
    if (activeTab === 'all') return true;
    return alert.severity === activeTab;
  });

  const redAlertsCount = activeScenario.alerts.filter(a => a.severity === 'red').length;
  const yellowAlertsCount = activeScenario.alerts.filter(a => a.severity === 'yellow').length;
  const greenAlertsCount = activeScenario.alerts.filter(a => a.severity === 'green').length;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white" id="comexpilot-app-root">
      
      {/* Top Professional Header Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-4 py-3 sm:px-6 lg:px-8 shadow-xs" id="header-bar">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 font-display">ComexPilot</span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-4xs font-bold text-indigo-700 uppercase tracking-widest font-mono border border-indigo-100">
                  Audit Intelligence
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Copiloto Aduaneiro de Despacho e Prevenção de Canal Vermelho • ANVISA • MAPA</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              id="btn-tutorial-guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>{showGuide ? 'Ocultar Legislação' : 'Guia Normativo'}</span>
            </button>
            <div className="flex items-center space-x-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-4xs font-bold text-slate-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="font-mono">GEMINI 3.5 ACTIVE</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" id="main-content">
        
        {/* Educational Legislação Segment */}
        {showGuide && (
          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-2xs transition-all" id="educational-guide-banner">
            <div className="flex items-start space-x-3">
              <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-indigo-950 font-display">Conformidade Adiantada na Importação de Cosméticos</h3>
                <p className="text-xs text-indigo-900/95 leading-relaxed">
                  O Capítulo 33 da NCM (Cosméticos e Higiene) é severamente fiscalizado no Brasil. Segundo a <strong>RDC 752/2022</strong> e as atualizações da <strong>RDC 907/2024 da ANVISA</strong>, qualquer desembaraço exige registro de <strong>Licença de Importação (LI) pré-embarque</strong>. Divergências de preço unitário e descrições com "apelo orgânico/vegetal" induzem conflitos imediatos com o MAPA, paralisando cargas no canal cinza de combate a fraudes aduaneiras.
                </p>
                <div className="pt-2 grid gap-2 sm:grid-cols-3">
                  <div className="bg-white/80 p-2 rounded border border-indigo-100 text-3xs">
                    <strong className="text-rose-700 block">🛑 Canal Cinza (IN 1986/20)</strong>
                    Preços abaixo do valor de referência de mercado geram retenção imediata de até 180 dias para valoração.
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-indigo-100 text-3xs">
                    <strong className="text-amber-700 block">⚠️ Conflito ANVISA x MAPA</strong>
                    Termos como "Organic" ou "Aloe Vera" acionam duplo canal fiscal aduaneiro Saúde + Agricultura.
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-indigo-100 text-3xs">
                    <strong className="text-emerald-700 block">💵 Oportunidade Ex-Tarifário</strong>
                    Redução compulsória legal de II a 0% para insumos produtivos e bens de capital sem similar nacional.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Live Statistics Row */}
        <div className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Probabilidade Canal Vermelho</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-slate-900">{activeScenario.riskScore}%</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${getRiskBadgeColor(activeScenario.riskScore)}`}>
                  {getRiskLabel(activeScenario.riskScore)}
                </span>
              </div>
              <span className="text-3xs text-slate-400 block mt-0.5">Simulação de parametrização fiscal</span>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${activeScenario.riskScore >= 70 ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-indigo-50 border-indigo-100 text-indigo-500'}`}>
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total FOB Declarado</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-slate-900">{formatCurrency(activeScenario.totalFobUsd, activeScenario.currency)}</span>
              </div>
              <span className="text-3xs text-slate-500 block mt-0.5">{activeScenario.items.length} itens aduaneiros ativos</span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Divergências Críticas</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-rose-600">{redAlertsCount}</span>
                <span className="text-3xs text-rose-500 font-bold uppercase">Irregularidades</span>
              </div>
              <span className="text-3xs text-slate-400 block mt-0.5">Exigem Licença ou ajuste aduaneiro urgente</span>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${redAlertsCount > 0 ? 'bg-rose-50 border-rose-100 text-rose-500 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Oportunidades de Caixa</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-emerald-600">
                  R$ {activeScenario.items.reduce((total, item) => {
                    const cleanItemNcm = (item.ncm || "").replace(/[^0-9]/g, "");
                    const rule = customRules.find(r => r.ncm.replace(/[^0-9]/g, "").startsWith(cleanItemNcm) || cleanItemNcm.startsWith(r.ncm.replace(/[^0-9]/g, "")));
                    if (rule) {
                      let itemSavings = 0;
                      if (rule.hasExTarifario) {
                        itemSavings += ((rule.standardIiRate - (rule.exTarifarioRate || 0)) / 100) * item.totalPrice;
                      }
                      if (rule.hasPisCofinsZeroOpportunity) {
                        itemSavings += 0.1175 * item.totalPrice;
                      }
                      return total + (itemSavings * 5.5);
                    }
                    return total;
                  }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <span className="text-3xs text-slate-500 block mt-0.5">Economias federais via benefícios</span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 2-Column Main Workspace */}
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* LEFT SIDEBAR WORKSPACE: Concierge, WhatsApp Audio & Uploads */}
          <div className="lg:col-span-5 space-y-6">

            {/* 1. INTERACTIVE "CONCIERGE" WIDGET */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs" id="concierge-widget">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-3">
                <div className="h-7 w-7 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 font-display">Concierge de Licenciamento ANVISA</h3>
                  <p className="text-[10px] text-slate-500">Digite um produto do Cap. 33 ou NCM para ver as exigências</p>
                </div>
              </div>

              {/* Two Column Layout inside Concierge */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-12">
                
                {/* Search query panel (left column) */}
                <div className="sm:col-span-5 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Produto ou NCM:</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleConciergeSearch(e.target.value)}
                      placeholder="Ex: shampoo, batom, 3304"
                      className="w-full rounded-md border border-slate-200 pl-8 pr-2 py-1.5 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Sugestões rápidas:</span>
                    <div className="flex flex-wrap gap-1">
                      {['protetor solar', 'perfumes', 'xampus', 'sombras'].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleConciergeSearch(tag)}
                          className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-[10px] hover:bg-indigo-50 hover:text-indigo-700 transition font-semibold"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Instant ANVISA rules highlighted (right column) */}
                <div className="sm:col-span-7 bg-slate-50 rounded-lg p-3 border border-slate-150 flex flex-col justify-between">
                  {selectedConciergeItem ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded">
                          NCM {selectedConciergeItem.ncm}
                        </span>
                        <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-rose-200">
                          ANVISA LI Obrigatória
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-800 leading-tight">{selectedConciergeItem.description}</h4>
                      
                      <div className="text-[11px] text-slate-600 space-y-1">
                        <div>
                          Regra Básica: <span className="font-semibold bg-yellow-100 text-slate-900 px-1 rounded">RDC 752/2022</span> da ANVISA.
                        </div>
                        <div>
                          Atualização: <span className="font-semibold">{selectedConciergeItem.mainNormative}</span> para procedimentos Siscomex.
                        </div>
                        <div>
                          Preço Ref. Valoração: <span className="font-mono font-bold text-slate-900">${selectedConciergeItem.minPriceUsd.toFixed(2)} FOB / un</span>.
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
                        <a 
                          href={selectedConciergeItem.normativeLink}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 hover:underline"
                        >
                          Normativa ANVISA Legislis ↗
                        </a>
                        <span className="text-[9px] text-slate-400 font-mono">Controle Ativo</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      <p>Nenhuma regra de cosméticos selecionada.</p>
                      <p className="text-[10px] mt-1">Busque acima por NCM ou descrição.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* 2. WHATSAPP AUDIO / VOICE CHANNEL VERDICT */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs" id="voice-whatsapp-integration">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-3">
                <div className="h-7 w-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 font-display">Canal Integrado de Áudio WhatsApp</h3>
                  <p className="text-[10px] text-slate-500">Simule o envio de mensagens de voz e gere laudos instantâneos</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2 border border-slate-150">
                  <span className="text-3xs font-bold text-slate-400 uppercase block tracking-wider">Selecione o áudio do despachante:</span>
                  <select
                    value={selectedAudioPreset}
                    onChange={(e: any) => {
                      setSelectedAudioPreset(e.target.value);
                      setAudioTranscription('');
                      setAudioVerdict('');
                    }}
                    className="bg-white text-xs font-semibold rounded border border-slate-200 px-1.5 py-0.5 focus:outline-none"
                  >
                    <option value="comex_audio_1">Áudio #1 - Cosmético Aloe Vera (Coreia do Sul)</option>
                    <option value="comex_audio_2">Áudio #2 - Sabonete de Toucador (França)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-3 bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                  <button
                    onClick={triggerVoiceAnalysis}
                    disabled={isAudioLoading || isAudioPlaying}
                    className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm disabled:opacity-50 transition"
                  >
                    {isAudioPlaying ? (
                      <Square className="w-4 h-4 fill-white" />
                    ) : (
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-3xs font-bold text-emerald-800 uppercase">Mensagem de Voz Recebida</span>
                      <span className="text-3xs font-mono text-slate-400">0:14 s</span>
                    </div>

                    {/* Realistic moving audio wave */}
                    <div className="flex items-center space-x-0.5 h-6">
                      {[6, 12, 18, 10, 4, 16, 22, 14, 8, 18, 24, 12, 6, 16, 20, 10, 8, 14, 18, 4, 12, 16, 8, 6, 14].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: isAudioPlaying ? `${h}px` : '4px' }}
                          className={`w-[3px] rounded-full bg-emerald-500 transition-all duration-150 ${isAudioPlaying ? 'animate-pulse' : ''}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>

                {isAudioLoading && (
                  <div className="text-center py-2 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Processando áudio com Whisper & analisando com Gemini...</span>
                  </div>
                )}

                {audioTranscription && (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-700 border border-slate-200">
                      <strong className="text-3xs font-bold text-slate-400 uppercase block tracking-wider mb-1">Transcrição do Áudio:</strong>
                      <p className="italic">"{audioTranscription}"</p>
                    </div>

                    <div className="rounded-xl bg-indigo-50 p-3 text-xs text-slate-800 border border-indigo-100 space-y-1">
                      <strong className="text-3xs font-bold text-indigo-700 uppercase block tracking-wider mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        Parecer Técnico Aduaneiro do ComexPilot:
                      </strong>
                      <div className="whitespace-pre-line text-[11px] leading-relaxed font-sans">{audioVerdict}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. DOCUMENT DROPZONE & SCENARIO CARRIER */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs" id="dropzone-workspace">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-3">
                <div className="h-7 w-7 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 font-display">Simulador Dropzone de Documentos</h3>
                  <p className="text-[10px] text-slate-500">Arraste documentos aduaneiros (Invoice / BL) para análise</p>
                </div>
              </div>

              {/* Drag Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                  dragOver ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2 stroke-1" />
                <p className="text-xs font-bold text-slate-700">Arraste sua Invoice ou BL aqui</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Suporta formatos PDF, PNG, XML ou TXT</p>
                
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <button
                    onClick={() => handleSimulateLocalFile('INVOICE_AMOUR_88402.pdf', 0)}
                    className="bg-white text-slate-600 rounded border border-slate-200 px-2 py-0.5 text-4xs font-bold font-mono hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition"
                  >
                    Simular Amour Cosmetics.pdf
                  </button>
                  <button
                    onClick={() => handleSimulateLocalFile('INVOICE_SUMMIT_STANLEY.pdf', 1)}
                    className="bg-white text-slate-600 rounded border border-slate-200 px-2 py-0.5 text-4xs font-bold font-mono hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition"
                  >
                    Simular Stanley Cups.pdf
                  </button>
                </div>

                {draggedFile && (
                  <div className="mt-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-2.5 py-1 text-3xs font-bold font-mono inline-flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Ativo: {draggedFile}</span>
                  </div>
                )}
              </div>

              {/* Manual Custom Text Analysis */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inserir Texto Adicional Manualmente:</span>
                <textarea
                  value={invoiceText}
                  onChange={(e) => setInvoiceText(e.target.value)}
                  placeholder="Se preferir, cole o texto da Invoice aqui para extrair NCMs e analisar via IA..."
                  className="w-full h-20 rounded-md border border-slate-200 p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                />
                
                {errorMsg && (
                  <div className="rounded-md bg-rose-50 border border-rose-200 p-2 text-3xs text-rose-700 flex items-start gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleAnalyzeCustomInvoice}
                  disabled={isLoading}
                  className="w-full rounded-lg bg-indigo-600 text-white font-bold text-xs py-2 shadow hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Extraindo Dados do Texto...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Analisar Texto via ComexPilot AI ⚡
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT PANELS: prioritized alerts feed and prefilled active analysis */}
          <div className="lg:col-span-7 space-y-6">

            {/* A. PRIORITIZED CARGO FEED (FILA DE PRIORIDADES) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" id="prioritized-cargo-feed">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 font-display uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-4 h-4 text-rose-600" />
                    Fila de Triagem Preventiva (Cargos Ativos)
                  </h3>
                  <p className="text-[10px] text-slate-500">Fluxos organizados por severidade e exposição financeira</p>
                </div>
                <span className="text-3xs font-mono text-slate-500 bg-white border border-slate-200 rounded px-2 py-0.5">
                  Preços Híbridos Ativos
                </span>
              </div>

              <div className="divide-y divide-slate-150">
                {CARGO_LOTS_FEED.map((cargo) => {
                  const isHighRisk = cargo.riskClass === 'high';
                  const isMediumRisk = cargo.riskClass === 'medium';
                  
                  return (
                    <div key={cargo.id} className="p-4 hover:bg-slate-50/40 transition">
                      
                      {/* Cargo identity row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-base">{cargo.flag}</span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block leading-tight">{cargo.name}</span>
                            <span className="text-4xs font-mono text-slate-400 block uppercase">Container ID: {cargo.containerId}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                            isHighRisk ? 'bg-rose-100 text-rose-800 border-rose-200' :
                            isMediumRisk ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            {isHighRisk ? 'Risco Crítico' : isMediumRisk ? 'Atenção' : 'Conforme'}
                          </span>

                          <span className={`text-3xs font-mono font-bold ${cargo.financialRiskValue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {cargo.financialRiskValue > 0 
                              ? `Risco: R$ ${cargo.financialRiskValue.toLocaleString('pt-BR')}` 
                              : `Otimização: R$ ${Math.abs(cargo.financialRiskValue).toLocaleString('pt-BR')}`
                            }
                          </span>
                        </div>
                      </div>

                      <div className="text-2xs text-slate-600 mb-2.5 font-semibold bg-slate-50 p-1.5 rounded border border-slate-100 flex items-center justify-between">
                        <span>Produto: {cargo.product}</span>
                        <span className="font-mono bg-white px-1 border rounded text-slate-500 text-3xs shrink-0 select-all ml-1">NCM {cargo.ncm}</span>
                      </div>

                      {/* Cargo warnings inner feed */}
                      <div className="space-y-2">
                        {cargo.alerts.map((alert) => (
                          <div key={alert.id} className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1.5 shadow-3xs">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start space-x-1.5">
                                <span className="mt-0.5 shrink-0">
                                  {alert.severity === 'red' ? (
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                                  ) : alert.severity === 'yellow' ? (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                </span>
                                <strong className="text-3xs font-bold text-slate-800 leading-tight block">{alert.title}</strong>
                              </div>
                              <span className={`text-[8px] font-bold uppercase tracking-wider font-mono px-1 rounded ${
                                alert.severity === 'red' ? 'bg-rose-50 text-rose-700' :
                                alert.severity === 'yellow' ? 'bg-amber-50 text-amber-700' :
                                'bg-emerald-50 text-emerald-700'
                              }`}>
                                {alert.severity === 'red' ? 'Bloqueio' : alert.severity === 'yellow' ? 'Atenção' : 'Oportunidade'}
                              </span>
                            </div>

                            <p className="text-3xs text-slate-500 leading-relaxed pl-5">"{alert.desc}"</p>
                            
                            <div className="bg-slate-50 p-1.5 rounded text-4xs font-mono text-slate-400 pl-5">
                              <strong>Base Legal:</strong> {alert.legal}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pl-5">
                              <span className="text-3xs text-slate-600 font-bold italic">
                                👉 {alert.action}
                              </span>

                              {alert.type === 'LI_ANVISA' && (
                                <button
                                  onClick={() => openLiMinutaForCargo(cargo)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2 py-0.8 rounded shadow-sm hover:scale-[1.02] active:scale-[0.98] transition flex items-center gap-1 shrink-0 self-end sm:self-auto"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Gerar Minuta de LI Automatizada
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* B. DETAILED AUDIT FOR CURRENT ACTIVE SCENARIO */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" id="second-page-panel">
              
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display flex items-center gap-1">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    Segunda Página de Alertas do Fiscal ({activeScenario.fileName})
                  </h3>
                  <p className="text-3xs text-slate-500">Auditoria do arquivo ativo carregado no simulador aduaneiro</p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`rounded px-2 py-0.5 text-3xs font-bold transition ${activeTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}
                  >
                    Todos ({activeScenario.alerts.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('red')}
                    className={`rounded px-2 py-0.5 text-3xs font-bold transition flex items-center gap-0.5 ${activeTab === 'red' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}
                  >
                    🔴 ({redAlertsCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('yellow')}
                    className={`rounded px-2 py-0.5 text-3xs font-bold transition flex items-center gap-0.5 ${activeTab === 'yellow' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}
                  >
                    🟡 ({yellowAlertsCount})
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1 stroke-1" />
                    <p className="text-xs font-bold text-slate-700">Tudo em conformidade!</p>
                    <p className="text-3xs text-slate-400">Nenhum erro de parametrização aduaneira ou regulatória encontrado.</p>
                  </div>
                ) : (
                  filteredAlerts.map((alert) => {
                    const styles = getSeverityStyles(alert.severity);
                    return (
                      <div key={alert.id} className={`rounded-xl border p-3.5 transition ${styles.bg} ${styles.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-2">
                            <div className="mt-0.5 shrink-0">{styles.icon}</div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 leading-snug">{alert.title}</h4>
                              {alert.affectedItems && (
                                <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] font-mono text-slate-500">
                                  <span>Mercadoria(s):</span>
                                  {alert.affectedItems.map((item, i) => (
                                    <span key={i} className="bg-white border rounded px-1 max-w-xs truncate">{item}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase shrink-0 ${styles.badge}`}>
                            {styles.label}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2 text-3xs border-t border-slate-200/50 pt-2.5">
                          <p className="text-slate-600 leading-relaxed text-2xs">{alert.description}</p>
                          
                          <div className="rounded bg-white p-2 border border-slate-150">
                            <span className="font-bold text-slate-700 uppercase block tracking-wider text-[9px]">Base Legal / Fundamento Regulador:</span>
                            <p className="text-slate-600 mt-0.5 font-mono">{alert.baseLegal}</p>
                          </div>

                          <div className="rounded bg-white p-2 border border-slate-150">
                            <span className="font-bold text-rose-800 uppercase block tracking-wider text-[9px]">Impacto Financeiro Estimado:</span>
                            <p className="text-slate-700 mt-0.5">{alert.impactoFinanceiro}</p>
                          </div>

                          <div className="rounded bg-indigo-50/50 p-2 border border-indigo-100">
                            <span className="font-bold text-indigo-900 uppercase block tracking-wider text-[9px]">Plano de Ação e Tratamento:</span>
                            <p className="text-indigo-950 font-bold mt-0.5">{alert.planoAcao}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Items data table */}
              <div className="border-t border-slate-200">
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-150">
                  Lista Detalhada de Itens Declarados na Fatura
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-3xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 font-bold uppercase text-slate-400 tracking-wider">
                        <th className="px-3 py-2">Item / Descrição</th>
                        <th className="px-3 py-2">Código NCM</th>
                        <th className="px-3 py-2 text-right">Preço Unit.</th>
                        <th className="px-3 py-2 text-center">Qtd.</th>
                        <th className="px-3 py-2 text-right">Valor FOB</th>
                        <th className="px-3 py-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {activeScenario.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-800">
                            <div>{item.description}</div>
                            {item.additionalDetails && <div className="text-[9px] text-slate-400 font-mono italic mt-0.5">{item.additionalDetails}</div>}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.2">{item.ncm}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">${item.unitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center font-mono">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-indigo-900">${item.totalPrice.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => openLiMinutaForActiveItem(item)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                            >
                              Fazer Minuta
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400" id="app-footer">
        <div className="mx-auto max-w-7xl">
          <p className="font-semibold text-slate-500 font-display">ComexPilot AI • Inteligência Aduaneira em Comércio Exterior Brasileiro</p>
          <p className="text-3xs text-slate-400 font-mono mt-1">Conformidade e Triagem Preventiva • IN RFB 1986/2020 • RDC ANVISA 752/2022 • CAMEX • GECEX 227/2021</p>
        </div>
      </footer>

      {/* SLIDE-OVER / MODAL: SISCOMEX LI MINUTA AUTODEFERIDA */}
      {isLiModalOpen && liPrefilledData && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            
            {/* Dark overlay backdrop */}
            <div 
              onClick={() => setIsLiModalOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            ></div>

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              
              {/* Modal Container */}
              <div className="pointer-events-auto w-screen max-w-md transform transition-all duration-300 ease-in-out bg-white shadow-2xl flex flex-col justify-between">
                
                {/* Header */}
                <div className="px-4 py-5 bg-indigo-600 text-white sm:px-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold uppercase tracking-wider font-display flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Mesa de LI Automatizada (Siscomex)
                    </h2>
                    <p className="text-3xs text-indigo-100 font-sans">Ajuste técnico preventivo de Licença de Importação ANVISA</p>
                  </div>
                  <button 
                    onClick={() => setIsLiModalOpen(false)}
                    className="rounded-md text-indigo-200 hover:text-white hover:bg-indigo-700/50 p-1.5 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Body */}
                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-3xs text-amber-900 leading-relaxed flex gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <strong>Aviso Regulatório:</strong> O deferimento adiantado no Siscomex requer exatidão absoluta nos campos descritivos para que os robôs da ANVISA cruzem dados de rotulagem sem interrupções manuais.
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-3 text-xs">
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-3xs font-bold uppercase text-slate-400 block mb-1">NCM do Item:</label>
                        <input
                          type="text"
                          value={liPrefilledData.ncm}
                          onChange={(e) => setLiPrefilledData({ ...liPrefilledData, ncm: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-3xs font-bold uppercase text-slate-400 block mb-1">Origem / Fabricação:</label>
                        <input
                          type="text"
                          value={liPrefilledData.origin}
                          onChange={(e) => setLiPrefilledData({ ...liPrefilledData, origin: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-3xs font-bold uppercase text-slate-400 block mb-1">Descrição Comercial Aduaneira (Completa):</label>
                      <textarea
                        value={liPrefilledData.description}
                        onChange={(e) => setLiPrefilledData({ ...liPrefilledData, description: e.target.value })}
                        className="w-full rounded border border-slate-200 p-2 text-xs font-semibold h-16 leading-tight focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-3xs font-mono bg-slate-50 p-2 rounded border border-slate-150">
                      <div>Qtd: <span className="font-bold text-slate-800">{liPrefilledData.quantity}</span></div>
                      <div>Preço: <span className="font-bold text-slate-800">${liPrefilledData.unitPrice.toFixed(2)}</span></div>
                      <div>Total FOB: <span className="font-bold text-slate-900">${liPrefilledData.totalPrice.toFixed(2)}</span></div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-150">
                      <div>
                        <label className="text-3xs font-bold uppercase text-slate-400 block mb-1">Razão Social do Exportador:</label>
                        <input
                          type="text"
                          value={liExporterName}
                          onChange={(e) => setLiExporterName(e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-3xs font-bold uppercase text-slate-400 block mb-1">Fabricante de Origem:</label>
                        <input
                          type="text"
                          value={liManufacturerName}
                          onChange={(e) => setLiManufacturerName(e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* CPF DIGITAL SIGNATURE SECTION */}
                    <div className="pt-3 border-t border-slate-150 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-3xs font-bold uppercase text-slate-400 block">Assinatura Digital ICP-Brasil (Ajudante Aduaneiro):</label>
                        <button
                          type="button"
                          onClick={() => setIsSignedWithCpf(!isSignedWithCpf)}
                          className={`rounded px-2 py-0.5 text-3xs font-bold uppercase ${
                            isSignedWithCpf ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isSignedWithCpf ? 'VINCULADO' : 'INSERIR ASSINATURA'}
                        </button>
                      </div>

                      {isSignedWithCpf && (
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2.5 space-y-1.5 animate-fadeIn">
                          <div className="flex items-center space-x-2">
                            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <input
                              type="text"
                              value={cpfNumber}
                              onChange={(e) => setCpfNumber(e.target.value)}
                              placeholder="000.000.000-00"
                              className="bg-white border border-emerald-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold w-full text-slate-800 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          {cpfError && (
                            <span className="text-4xs text-rose-600 block font-bold font-sans">
                              ⚠️ {cpfError}
                            </span>
                          )}

                          <div className="text-[10px] text-emerald-800 leading-tight">
                            ✓ Token E-CPF ativo. O XML e o Termo gerados serão assinados eletronicamente sob a cadeia legal ICP-Brasil.
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>

                {/* Footer and Export Buttons */}
                <div className="px-4 py-4 bg-slate-50 border-t border-slate-150 sm:px-6 space-y-2 shrink-0">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExportXml}
                      disabled={isExporting}
                      className="rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Construindo...
                        </>
                      ) : (
                        <>
                          <FileCode className="w-3.5 h-3.5" />
                          Baixar XML Siscomex
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleExportTermoResponsabilidade}
                      disabled={isExporting}
                      className="rounded bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          Termo ANVISA .TXT
                        </>
                      )}
                    </button>
                  </div>
                  
                  <span className="text-[9px] text-slate-400 font-mono text-center block">
                    Gerado pelo motor ComexPilot AI • Uso preventivo homologado
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
