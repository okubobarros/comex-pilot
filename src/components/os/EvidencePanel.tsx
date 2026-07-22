/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Painel de Evidências (lateral direita, persistente). Exibe o "chain of thought"
 * do último agente e as citações normativas clicáveis — cada citação puxa o texto
 * real de mcat.norma (/api/norma). Pilares Confiança + Clareza do PRD.
 */
import React, { useState } from 'react';
import { BookOpen, Brain, ChevronRight, Loader2, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEvidence } from '../../context/EvidenceContext';

interface NormaData {
  identificacao: string;
  tipo?: string;
  orgao_emissor?: string;
  ementa?: string;
  vigencia_inicio?: string;
}

export default function EvidencePanel() {
  const { evidence } = useEvidence();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, NormaData | 'loading' | 'erro'>>({});

  const toggleCitation = async (ref: string) => {
    setOpen((cur) => (cur === ref ? null : ref));
    if (cache[ref] && cache[ref] !== 'erro') return;
    setCache((c) => ({ ...c, [ref]: 'loading' }));
    try {
      const resp = await fetch(`/api/norma?ref=${encodeURIComponent(ref)}`);
      const data = await resp.json();
      setCache((c) => ({ ...c, [ref]: data.success ? data.norma : 'erro' }));
    } catch {
      setCache((c) => ({ ...c, [ref]: 'erro' }));
    }
  };

  if (collapsed) {
    return (
      <div className="hidden w-8 shrink-0 border-l border-slate-200 bg-white lg:block">
        <button onClick={() => setCollapsed(false)} title="Abrir Painel de Evidências" className="flex h-10 w-full items-center justify-center text-slate-400 hover:text-indigo-600">
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex" id="evidence-panel">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight text-slate-900">Painel de Evidências</h2>
          <p className="text-[11px] text-slate-400">Raciocínio + base normativa</p>
        </div>
        <button onClick={() => setCollapsed(true)} title="Recolher" className="text-slate-400 hover:text-slate-600">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!evidence ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[11px] leading-relaxed text-slate-400">
            Nenhum agente agiu ainda. Rode um custeio ou uma auditoria para ver o raciocínio e as citações aqui.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">{evidence.titulo}</div>

            {/* Chain of Thought */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Brain className="h-3.5 w-3.5 text-indigo-500" /> Raciocínio do agente
              </div>
              <ol className="space-y-2">
                {evidence.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-slate-600">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-mono text-[9px] font-semibold text-indigo-600">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Citações normativas */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <BookOpen className="h-3.5 w-3.5 text-indigo-500" /> Base normativa
              </div>
              <div className="space-y-1.5">
                {evidence.citations.map((c) => {
                  const st = cache[c.ref];
                  const isOpen = open === c.ref;
                  return (
                    <div key={c.ref} className="rounded-lg border border-slate-200">
                      <button onClick={() => toggleCitation(c.ref)} className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left">
                        <span className="font-mono text-[11px] font-semibold text-slate-700">{c.ref}</span>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-slate-100 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500">
                          {st === 'loading' && <span className="flex items-center gap-1 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> consultando…</span>}
                          {st === 'erro' && <span className="text-amber-600">Norma não encontrada na base.</span>}
                          {st && typeof st === 'object' && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{st.tipo} · {st.orgao_emissor}</div>
                              <p className="text-slate-600">{st.ementa}</p>
                            </div>
                          )}
                          {c.nota && <p className="mt-1 text-slate-400">{c.nota}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
