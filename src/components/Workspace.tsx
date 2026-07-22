/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  FileSpreadsheet,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Calculator,
  ChevronRight,
  Boxes
} from 'lucide-react';
import Logo from './Logo';
import LandedCostDrawer from './LandedCostDrawer';
import AuditWorkspace from './audit/AuditWorkspace';
import { AuditAlert, InvoiceAnalysis, InvoiceItem, WorkspaceMode, WorkspaceStatus } from '../types';

interface WorkspaceProps {
  status: WorkspaceStatus;
  mode: WorkspaceMode;
  analysis: InvoiceAnalysis | null;
  savingsBrl: number;
  onGenerateLi: (item: InvoiceItem) => void;
  onAlertInquire: (alert: AuditAlert) => void;
  onOpenLandedCost: () => void;
  onCloseLandedCost: () => void;
}

const formatCurrency = (val: number, curr: string = 'USD') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: curr }).format(val);

const getRiskBadgeColor = (score: number) => {
  if (score >= 70) return 'border-rose-300 bg-rose-100 text-rose-800';
  if (score >= 30) return 'border-amber-300 bg-amber-100 text-amber-800';
  return 'border-emerald-300 bg-emerald-100 text-emerald-800';
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
        bg: 'border-rose-200 bg-rose-50/60',
        border: 'border-l-4 border-l-rose-500',
        badge: 'bg-rose-100 text-rose-800',
        icon: <ShieldAlert className="h-4 w-4 text-rose-600" />,
        label: 'Bloqueio'
      };
    case 'yellow':
      return {
        bg: 'border-amber-200 bg-amber-50/60',
        border: 'border-l-4 border-l-amber-500',
        badge: 'bg-amber-100 text-amber-800',
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        label: 'Atenção'
      };
    case 'green':
      return {
        bg: 'border-emerald-200 bg-emerald-50/60',
        border: 'border-l-4 border-l-emerald-500',
        badge: 'bg-emerald-100 text-emerald-800',
        icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
        label: 'Oportunidade'
      };
    default:
      return {
        bg: 'border-slate-200 bg-slate-50',
        border: 'border-l-4 border-l-slate-400',
        badge: 'bg-slate-100 text-slate-800',
        icon: <Info className="h-4 w-4 text-slate-500" />,
        label: 'Regular'
      };
  }
};

export default function Workspace({ status, mode, analysis, savingsBrl, onGenerateLi, onAlertInquire, onOpenLandedCost, onCloseLandedCost }: WorkspaceProps) {
  // Botão de minuta em estado "Gerando..." (id do alerta ou do item)
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Skill densa ocupa o canvas por cima de qualquer estado de auditoria
  if (mode === 'landedCost') {
    return <LandedCostDrawer onClose={onCloseLandedCost} />;
  }

  // Vincula um alerta ao item da fatura correspondente para prefill da LI
  const itemForAlert = (alert: AuditAlert): InvoiceItem | undefined => {
    if (!analysis) return undefined;
    return (
      analysis.items.find(item =>
        alert.affectedItems?.some(name => item.description.includes(name) || name.includes(item.description))
      ) ?? analysis.items[0]
    );
  };

  const startGenerating = (key: string, item: InvoiceItem) => {
    if (generatingId) return;
    setGeneratingId(key);
    setTimeout(() => {
      setGeneratingId(null);
      onGenerateLi(item);
    }, 1500);
  };

  /* ---------- EMPTY: boas-vindas + cards de skills ---------- */
  if (status === 'empty') {
    return (
      <section className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-slate-50" id="workspace-empty">
        <div className="w-full max-w-lg px-8 text-center">
          <Logo className="mx-auto mb-6 h-16 w-16" />
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Workspace de Auditoria
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Aguardando documento ou comando de voz para iniciar a auditoria — ou abra uma skill estruturada abaixo.
          </p>

          <div className="mt-8 space-y-2.5 text-left">
            <span className="block text-center font-mono text-[10px] uppercase tracking-widest text-slate-400">Skills de missão</span>
            <button
              onClick={onOpenLandedCost}
              className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-md"
              id="skill-landed-cost"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Calculator className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="block text-sm font-semibold text-slate-900">Custeio e Viabilidade (Landed Cost)</span>
                <span className="block text-xs text-slate-400">Formulário assistido em 3 passos: impostos, câmbio e margem alvo</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" />
            </button>

            <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-left opacity-70">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
                <Boxes className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="block text-sm font-semibold text-slate-500">Roteiro de Nacionalização</span>
                <span className="block text-xs text-slate-400">Passo a passo DI/Duimp · em breve</span>
              </div>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-500">Em breve</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ---------- LOADING: esqueleto elegante do veredito ---------- */
  if (status === 'loading') {
    return (
      <section className="h-full flex-1 overflow-y-auto bg-slate-100/60" id="workspace-loading">
        <div className="mx-auto max-w-4xl animate-pulse space-y-5 px-6 py-6">

          {/* File tab skeleton */}
          <div className="flex items-end justify-between">
            <div className="h-9 w-56 rounded-t-xl border border-b-0 border-slate-200 bg-white"></div>
            <div className="mb-2 h-3 w-40 rounded bg-slate-200/70"></div>
          </div>

          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-48 rounded-md bg-slate-200"></div>
              <div className="h-3 w-64 rounded bg-slate-200/70"></div>
            </div>
            <div className="h-7 w-28 rounded-full bg-slate-200"></div>
          </div>

          {/* Metrics skeleton */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="h-2.5 w-16 rounded bg-slate-200"></div>
                <div className="mt-3 h-5 w-20 rounded bg-slate-200"></div>
              </div>
            ))}
          </div>

          {/* Triage feed skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <div className="h-4 w-52 rounded bg-slate-200"></div>
            </div>
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-3/5 rounded bg-slate-200"></div>
                    <div className="h-4 w-16 rounded bg-slate-200/70"></div>
                  </div>
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <div className="h-3 w-full rounded bg-slate-200/70"></div>
                    <div className="h-3 w-11/12 rounded bg-slate-200/70"></div>
                    <div className="h-3 w-2/3 rounded bg-slate-200/70"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items table skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="space-y-2.5">
              <div className="h-3 w-full rounded bg-slate-200/70"></div>
              <div className="h-3 w-10/12 rounded bg-slate-200/70"></div>
            </div>
          </div>

        </div>
      </section>
    );
  }

  /* ---------- COMPLETE: o veredito ---------- */
  if (!analysis) return null;

  return <AuditWorkspace analysis={analysis} onGenerateLi={onGenerateLi} onAlertInquire={onAlertInquire} />;
}
