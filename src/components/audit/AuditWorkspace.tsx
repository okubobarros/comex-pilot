/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veredito da Auditoria em 3 colunas (PRD §3 / mock 07.png):
 *   Esquerda  → Documento fonte extraído (FOB, itens, NCM).
 *   Centro    → Bloqueios (accordion): base legal clicável, impacto, plano de
 *               ação e checkbox "Validação humana" (pilar Controle).
 *   Direita   → Ação: pré-visualização da Minuta de LI + baixar/assinar.
 */
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, FileSignature, Loader2, Download, PenLine, ShieldAlert, TrendingUp } from 'lucide-react';
import { AuditAlert, InvoiceAnalysis, InvoiceItem } from '../../types';
import { normaLocal } from '../../engine/offline';

interface AuditWorkspaceProps {
  analysis: InvoiceAnalysis;
  onGenerateLi: (item: InvoiceItem) => void;
  onAlertInquire: (alert: AuditAlert) => void;
}

interface NormaData { identificacao: string; tipo?: string; orgao_emissor?: string; ementa?: string; }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const sev = (s: string) =>
  s === 'red' ? { dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700', label: 'Bloqueio', icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-600" /> }
  : s === 'yellow' ? { dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700', label: 'Atenção', icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> }
  : { dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700', label: 'Oportunidade', icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> };

// Extrai a 1ª norma citável (ex.: "RDC nº 752/2022" → "RDC 752/2022") do texto de base legal.
function extractRef(baseLegal: string): string | null {
  const m = baseLegal.match(/(RDC|LC|IN RFB|Decreto|Resolução GECEX|Portaria SECEX)\s*n?[º°]?\s*([\d.]+\/\d{4})/i);
  return m ? `${m[1]} ${m[2]}`.replace(/\s+/g, ' ') : null;
}

export default function AuditWorkspace({ analysis, onGenerateLi, onAlertInquire }: AuditWorkspaceProps) {
  const [openId, setOpenId] = useState<string | null>(analysis.alerts[0]?.id ?? null);
  const [validated, setValidated] = useState<Record<string, boolean>>({});
  const [norma, setNorma] = useState<Record<string, NormaData | 'loading' | 'erro'>>({});
  const [generating, setGenerating] = useState<string | null>(null);

  const itemForAlert = (a: AuditAlert): InvoiceItem =>
    analysis.items.find((it) => a.affectedItems?.some((n) => it.description.includes(n) || n.includes(it.description))) ?? analysis.items[0];

  const loadNorma = async (ref: string) => {
    if (norma[ref] && norma[ref] !== 'erro') return;
    setNorma((n) => ({ ...n, [ref]: 'loading' }));
    try {
      const r = await fetch(`/api/norma?ref=${encodeURIComponent(ref)}`);
      const d = r.ok ? await r.json() : { success: false };
      setNorma((n) => ({ ...n, [ref]: d.success ? d.norma : (normaLocal(ref) ?? 'erro') }));
    } catch { setNorma((n) => ({ ...n, [ref]: normaLocal(ref) ?? 'erro' })); }
  };

  const gerarMinuta = (item: InvoiceItem) => {
    if (generating) return;
    setGenerating(item.id);
    setTimeout(() => { setGenerating(null); onGenerateLi(item); }, 1400);
  };

  const redBlock = analysis.alerts.find((a) => a.severity === 'red' && a.title.toUpperCase().includes('ANVISA'));
  const minutaItem = redBlock ? itemForAlert(redBlock) : analysis.items[0];

  return (
    <section className="h-full flex-1 overflow-hidden bg-slate-100/60" id="workspace-complete">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">

        {/* ESQUERDA — Documento */}
        <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <span aria-hidden>📄</span>
            <span className="truncate font-mono text-xs font-semibold text-slate-700">{analysis.fileName}</span>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Total FOB</span>
              <span className="font-mono text-sm font-semibold text-slate-800">{usd(analysis.totalFobUsd)}</span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Itens</span>
              <span className="font-mono text-sm font-semibold text-slate-800">{analysis.items.length}</span>
            </div>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Itens declarados</div>
          <div className="mt-2 space-y-2">
            {analysis.items.map((it) => (
              <div key={it.id} className="rounded-lg border border-slate-200 p-2.5">
                <p className="text-xs font-medium leading-snug text-slate-700">{it.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600">NCM {it.ncm}</span>
                  <span className="text-slate-400">{it.countryOfOrigin}</span>
                  <span className="ml-auto font-mono text-slate-500">{it.quantity} × ${it.unitPrice.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTRO — Bloqueios */}
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">Bloqueios e regras</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${analysis.riskScore >= 70 ? 'border-rose-200 bg-rose-50 text-rose-700' : analysis.riskScore >= 30 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              Risco {analysis.riskScore}%
            </span>
          </div>

          {analysis.alerts.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
              <CheckCircle2 className="mx-auto mb-1 h-8 w-8 stroke-1 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700">Tudo em conformidade</p>
            </div>
          ) : (
            <div className="space-y-2">
              {analysis.alerts.map((a) => {
                const s = sev(a.severity);
                const isOpen = openId === a.id;
                const ref = extractRef(a.baseLegal);
                const nd = ref ? norma[ref] : undefined;
                const isAnvisa = a.severity === 'red' && a.title.toUpperCase().includes('ANVISA');
                return (
                  <div key={a.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button onClick={() => setOpenId(isOpen ? null : a.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                      {s.icon}
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{a.title}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${s.chip}`}>{s.label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-2.5 border-t border-slate-100 px-3 py-3 text-[11px] leading-relaxed">
                        <p className="text-slate-500">{a.description}</p>

                        {/* Base legal clicável */}
                        <div>
                          <span className="font-semibold text-slate-500">Base legal: </span>
                          {ref ? (
                            <button onClick={() => loadNorma(ref)} className="font-mono text-indigo-600 underline decoration-dotted underline-offset-2 hover:text-indigo-800">{ref}</button>
                          ) : (
                            <span className="text-slate-500">{a.baseLegal}</span>
                          )}
                          {nd === 'loading' && <span className="ml-1 inline-flex items-center gap-1 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> …</span>}
                          {nd === 'erro' && <span className="ml-1 text-amber-600">(texto não disponível na base)</span>}
                          {nd && typeof nd === 'object' && (
                            <div className="mt-1 rounded-lg bg-slate-50 p-2 text-slate-600">
                              <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{nd.tipo} · {nd.orgao_emissor}</span>
                              {nd.ementa}
                            </div>
                          )}
                          <p className="mt-0.5 text-slate-400">{a.baseLegal}</p>
                        </div>

                        <p><span className="font-semibold text-rose-600">Impacto: </span><span className="text-slate-500">{a.impactoFinanceiro}</span></p>
                        <p><span className="font-semibold text-indigo-600">Plano de ação: </span><span className="text-slate-600">{a.planoAcao}</span></p>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                          <label className="flex cursor-pointer items-center gap-1.5 text-slate-600">
                            <input type="checkbox" checked={!!validated[a.id]} onChange={(e) => setValidated((v) => ({ ...v, [a.id]: e.target.checked }))} className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
                            Validação humana
                          </label>
                          <button onClick={() => onAlertInquire(a)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600">Perguntar ao agente →</button>
                        </div>

                        {isAnvisa && (
                          <button onClick={() => gerarMinuta(itemForAlert(a))} disabled={!!generating} className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
                            {generating === itemForAlert(a).id ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…</> : <><FileSignature className="h-3.5 w-3.5" /> Gerar Minuta de LI</>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DIREITA — Ação / Minuta */}
        <div className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <FileSignature className="h-4 w-4 text-indigo-500" />
            <h3 className="font-display text-sm font-semibold text-slate-900">Minuta de LI</h3>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="space-y-1.5 text-[11px]">
              {[
                ['NCM', minutaItem?.ncm],
                ['Produto', minutaItem?.description],
                ['Origem', minutaItem?.countryOfOrigin],
                ['Quantidade', String(minutaItem?.quantity ?? '')],
                ['Órgão anuente', redBlock ? 'ANVISA' : '—'],
                ['Base legal', redBlock ? 'RDC 752/2022' : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-slate-400">{k}</span>
                  <span className="truncate text-right font-medium text-slate-700">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                <Download className="h-3.5 w-3.5" /> Baixar XML
              </button>
              <button className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700">
                <PenLine className="h-3.5 w-3.5" /> Assinar
              </button>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            A minuta é gerada a partir do bloqueio de anuência. Aprove a validação humana antes de submeter ao Siscomex.
          </p>
        </div>
      </div>
    </section>
  );
}
