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
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { AuditAlert, InvoiceAnalysis, InvoiceItem, WorkspaceStatus } from '../types';

interface WorkspaceProps {
  status: WorkspaceStatus;
  analysis: InvoiceAnalysis | null;
  savingsBrl: number;
  onGenerateLi: (item: InvoiceItem) => void;
  onAlertInquire: (alert: AuditAlert) => void;
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

export default function Workspace({ status, analysis, savingsBrl, onGenerateLi, onAlertInquire }: WorkspaceProps) {
  // Botão de minuta em estado "Gerando..." (id do alerta ou do item)
  const [generatingId, setGeneratingId] = useState<string | null>(null);

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

  /* ---------- EMPTY: boas-vindas suíças ---------- */
  if (status === 'empty') {
    return (
      <section className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-slate-50" id="workspace-empty">
        <div className="max-w-md px-8 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-300">
            <Scale className="h-6 w-6 stroke-1" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Workspace de Auditoria
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Aguardando documento ou comando de voz para iniciar a auditoria aduaneira...
          </p>
          <div className="mx-auto mt-8 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-300">
            <span className="h-1 w-1 animate-pulse rounded-full bg-slate-300"></span>
            Agente em standby
          </div>
        </div>
      </section>
    );
  }

  /* ---------- LOADING: esqueleto elegante do veredito ---------- */
  if (status === 'loading') {
    return (
      <section className="h-full flex-1 overflow-y-auto bg-slate-50" id="workspace-loading">
        <div className="mx-auto max-w-4xl animate-pulse space-y-5 px-6 py-6">

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

  const redCount = analysis.alerts.filter(a => a.severity === 'red').length;

  return (
    <section className="h-full flex-1 overflow-y-auto bg-slate-50" id="workspace-complete">
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-6">

        {/* Verdict header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Veredito da Auditoria</h2>
            <p className="font-mono text-xs text-slate-400">
              {analysis.fileName} · {new Date(analysis.analyzedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className={`self-start rounded-full border px-3 py-1 text-xs font-semibold sm:self-auto ${getRiskBadgeColor(analysis.riskScore)}`}>
            {getRiskLabel(analysis.riskScore)} · {analysis.riskScore}%
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Canal Vermelho</span>
              <Activity className="h-4 w-4 text-slate-300" />
            </div>
            <span className="mt-1 block font-mono text-lg font-semibold text-slate-900">{analysis.riskScore}%</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total FOB</span>
              <FileSpreadsheet className="h-4 w-4 text-slate-300" />
            </div>
            <span className="mt-1 block font-mono text-lg font-semibold text-slate-900">{formatCurrency(analysis.totalFobUsd, analysis.currency)}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Bloqueios</span>
              <ShieldAlert className={`h-4 w-4 ${redCount > 0 ? 'text-rose-400' : 'text-slate-300'}`} />
            </div>
            <span className={`mt-1 block font-mono text-lg font-semibold ${redCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{redCount}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Economia Potencial</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="mt-1 block font-mono text-lg font-semibold text-emerald-600">
              R$ {savingsBrl.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Triage feed */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" id="triage-feed">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
            <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-rose-500" />
              Feed de Triagem Preventiva
            </h3>
            <span className="font-mono text-[10px] text-slate-400">{analysis.alerts.length} apontamentos do motor de regras</span>
          </div>

          <div className="space-y-3 p-5">
            {analysis.alerts.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
                <CheckCircle className="mx-auto mb-1 h-8 w-8 stroke-1 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-700">Tudo em conformidade</p>
                <p className="text-xs text-slate-400">Nenhuma divergência regulatória encontrada.</p>
              </div>
            ) : (
              analysis.alerts.map((alert) => {
                const styles = getSeverityStyles(alert.severity);
                const isAnvisaLi = alert.severity === 'red' && alert.title.toUpperCase().includes('ANVISA');
                const linkedItem = itemForAlert(alert);

                const isGenerating = generatingId === alert.id;
                return (
                  <div
                    key={alert.id}
                    onClick={() => onAlertInquire(alert)}
                    title="Clique para pedir ao agente o roteiro de resolução desta exigência"
                    className={`cursor-pointer rounded-xl border p-4 transition hover:shadow-md hover:ring-1 hover:ring-indigo-200 ${styles.bg} ${styles.border}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">{styles.icon}</div>
                        <h4 className="text-sm font-semibold leading-snug text-slate-900">{alert.title}</h4>
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${styles.badge}`}>
                        {styles.label}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-3">
                      <p className="text-sm leading-relaxed text-slate-500">{alert.description}</p>
                      <p className="text-xs leading-relaxed text-slate-400">
                        <span className="font-medium text-slate-500">Base legal:</span> {alert.baseLegal}
                      </p>
                      <p className="text-xs leading-relaxed text-slate-500">
                        <span className="font-medium text-rose-600">Impacto:</span> {alert.impactoFinanceiro}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 border-t border-slate-200/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-relaxed text-slate-600">
                        <span className="font-medium text-indigo-600">Plano de ação:</span> {alert.planoAcao}
                      </p>
                      {isAnvisaLi && linkedItem && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startGenerating(alert.id, linkedItem);
                          }}
                          disabled={!!generatingId}
                          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 sm:self-auto"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              Gerar Minuta de LI Automatizada
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-xs font-semibold text-slate-600">
            Itens declarados na fatura
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2">Descrição</th>
                  <th className="px-4 py-2">NCM</th>
                  <th className="px-4 py-2 text-right">Preço Unit.</th>
                  <th className="px-4 py-2 text-center">Qtd.</th>
                  <th className="px-4 py-2 text-right">Valor FOB</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{item.description}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono">{item.ncm}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-center font-mono">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">${item.totalPrice.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => startGenerating(item.id, item)}
                        disabled={!!generatingId}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60"
                      >
                        {generatingId === item.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          'Gerar Minuta'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}
