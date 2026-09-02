/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InvoiceItem {
  id: string;
  description: string;
  ncm: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  countryOfOrigin: string;
  totalPrice: number;
  additionalDetails?: string;
}

export type AlertSeverity = 'red' | 'yellow' | 'green';

export interface AuditAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  baseLegal: string;
  impactoFinanceiro: string;
  planoAcao: string;
  affectedItems: string[];
}

export interface InvoiceAnalysis {
  fileName: string;
  analyzedAt: string;
  items: InvoiceItem[];
  alerts: AuditAlert[];
  riskScore: number; // 0 to 100
  totalFobUsd: number;
  currency: string;
  isCustomUpload: boolean;
}

export type WorkspaceStatus = 'empty' | 'loading' | 'complete';

export type AppView = 'home' | 'workspace';

/**
 * Agente responsável por um resultado. Vivia em `os/AgentDock`, removido junto
 * com a barra inferior que duplicava a navegação lateral.
 */
export type AgentId = 'audit' | 'costing' | 'ncm' | 'compliance' | 'li' | 'chat';

export type TaskId =
  | 'audit'
  | 'compliance'
  | 'risk'
  | 'checklist'
  | 'landedCost'
  | 'freight'
  | 'margin'
  | 'classify'
  | 'ncm'
  | 'antidumping';

/**
 * Qual canvas ocupa a coluna central. Cada item do menu lateral tem o seu:
 * sem um modo próprio, a rota caía na tela genérica de auditoria vazia.
 */
export type WorkspaceMode = 'audit' | 'classify' | 'landedCost' | 'compliance' | 'freight';

/** Intenção multimodal ativa na barra de comando do chat */
export type ChatIntent = 'audit' | 'classify' | 'risk';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  variant?: 'text' | 'audio' | 'file' | 'image';
}

export interface ClassificationResult {
  ncm: string;
  officialDescription: string;
  agency: string;
  normative: string;
  justification: string;
  referencePriceUsd?: number;
  confidence: 'alta' | 'média' | 'baixa';
}

export interface LandedCostInputs {
  productDescription: string;
  ncm: string;
  origin: string;
  fobUsd: number;
  quantity: number;
  incoterm: string;
  entryPort: string;
  /**
   * Frete INTERNACIONAL, em USD. Compõe o valor aduaneiro (VMLD) junto com FOB
   * e seguro, e é sobre ele que incide o AFRMM. Taxas locais de destino NAO
   * entram aqui — ver `outrasDespesasBrl`.
   */
  freightUsd: number;
  insuranceUsd: number;
  /**
   * Despesas aduaneiras no destino, em BRL: THC/capatazia, ISPS, drop off,
   * BL fee, honorarios.
   *
   * Ficam FORA do valor aduaneiro — são custos posteriores à chegada, não
   * compõem o CIF — mas entram na base do ICMS, que é calculado "por dentro"
   * sobre o total das despesas aduaneiras. Somá-las ao frete internacional
   * inflaria a base de II, IPI, PIS, COFINS e AFRMM, fazendo o importador
   * recolher imposto a mais sobre um valor que a legislação não manda incluir.
   *
   * RESSALVA: a inclusão da capatazia no valor aduaneiro foi objeto de longa
   * disputa entre a Receita e os importadores, decidida no STJ em favor da
   * exclusão. É a posição adotada aqui, mas quem monta o custeio de uma
   * operação concreta deve confirmá-la com o assessor tributário — o número
   * muda conforme o entendimento aplicado.
   */
  outrasDespesasBrl?: number;
  /**
   * Quantidade de contêineres do embarque. Só aparece quando um frete foi
   * importado da cotação — é a partir da composição unitária dela que o frete
   * e as despesas são recalculados ao mudar este número.
   */
  containers?: number;
  iiRate: number;
  ipiRate: number;
  icmsRate: number;
  usdBrl: number;
  targetMarginPct: number;
}

export interface LiPrefillData {
  ncm: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  origin: string;
  legalRule: string;
  exporter: string;
  manufacturer: string;
}

export interface NcmRule {
  ncm: string;
  description: string;
  minReferencePrice: number; // USD
  isAntidumpingActive: boolean;
  antidumpingFeeKgUsd?: number;
  antidumpingOrigin?: string;
  requiresAnvisa: boolean;
  checkMapaConflict: boolean;
  requiresAnatel: boolean;
  requiresInmetro: boolean;
  hasExTarifario: boolean;
  exTarifarioRate?: number; // % II with Ex-Tarifario
  standardIiRate: number; // % standard II
  hasPisCofinsZeroOpportunity: boolean;
  pisCofinsZeroBasis?: string;
}
