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

/** Modo do canvas da direita: auditoria padrão ou skill densa (Landed Cost) */
export type WorkspaceMode = 'audit' | 'landedCost';

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
  freightUsd: number;
  insuranceUsd: number;
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
