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
