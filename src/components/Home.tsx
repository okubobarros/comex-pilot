/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centro de Operações — pipeline (Kanban) de processos ativos + barra de comando
 * e atalhos de intenção. Substitui o antigo grid de cards estáticos: agora a home
 * mostra o ESTADO REAL das operações (Pendente / Em Análise / Concluído).
 */
import React, { useState } from 'react';
import { ArrowUp, Calculator, FileText, Scale, Sparkles, Target } from 'lucide-react';
import type { TaskId } from '../types';
import { useProcessos, Processo, ProcStatus } from '../context/ProcessContext';
import type { AgentId } from './os/AgentDock';

interface HomeProps {
  aiStatus: 'idle' | 'success' | 'simulated';
  onOpenTask: (taskId: TaskId) => void;
  onRunCommand: (command: string) => void;
  onOpenProcess: (processo: Processo) => void;
}

const INTENT_SHORTCUTS: { id: TaskId; label: string; icon: React.ReactNode }[] = [
  { id: 'audit', label: 'Auditar documentos', icon: <Target className="h-3.5 w-3.5" /> },
  { id: 'landedCost', label: 'Calcular custo', icon: <Calculator className="h-3.5 w-3.5" /> },
  { id: 'classify', label: 'Classificar NCM', icon: <Scale className="h-3.5 w-3.5" /> },
  { id: 'risk', label: 'Analisar risco', icon: <FileText className="h-3.5 w-3.5" /> },
];

const AGENT_META: Record<AgentId, { label: string; tone: string }> = {
  audit: { label: 'Auditor', tone: 'bg-rose-50 text-rose-700 ring-rose-100' },
  costing: { label: 'Custeio', tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
  ncm: { label: 'Classificador', tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
  li: { label: 'Gerador LI', tone: 'bg-violet-50 text-violet-700 ring-violet-100' },
  chat: { label: 'Assistente', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const CANAL_DOT: Record<string, string> = { verde: 'bg-emerald-500', amarelo: 'bg-amber-500', vermelho: 'bg-rose-500' };

const COLUNAS: { status: ProcStatus; titulo: string }[] = [
  { status: 'pendente', titulo: 'Pendente' },
  { status: 'em_analise', titulo: 'Em Análise' },
  { status: 'concluido', titulo: 'Concluído' },
];

export default function Home({ aiStatus, onOpenTask, onRunCommand, onOpenProcess }: HomeProps) {
  const [command, setCommand] = useState('');
  const { processos } = useProcessos();

  const submitCommand = (event: React.FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    setCommand('');
    onRunCommand(value);
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#f7f8fa]" id="home-view">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Centro de operações
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">O que você precisa resolver hoje?</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">Descreva uma operação ou retome um processo em andamento no pipeline abaixo.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-500 shadow-sm sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${aiStatus === 'simulated' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {aiStatus === 'simulated' ? 'Motor local ativo' : 'Motor AI ativo'}
          </div>
        </header>

        <form onSubmit={submitCommand} className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-[0_12px_32px_rgba(15,23,42,0.06)] focus-within:border-slate-500">
          <Sparkles className="ml-2 h-5 w-5 shrink-0 text-indigo-500" />
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Descreva uma operação, documento ou dúvida..." className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
          <button type="submit" disabled={!command.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-indigo-700 disabled:opacity-25" title="Abrir comando">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>

        {/* Atalhos de intenção */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {INTENT_SHORTCUTS.map((s) => (
            <button key={s.id} onClick={() => onOpenTask(s.id)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
              {s.icon}{s.label}
            </button>
          ))}
        </div>

        {/* Pipeline (Kanban) */}
        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">Processos ativos</h2>
          </div>
          <span className="hidden text-xs text-slate-400 sm:block">{processos.length} operações</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {COLUNAS.map((col) => {
            const items = processos.filter((p) => p.status === col.status);
            return (
              <div key={col.status} className="rounded-2xl border border-slate-200 bg-white/60 p-2.5">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <h3 className="text-xs font-semibold text-slate-700">{col.titulo}</h3>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((p) => {
                    const meta = AGENT_META[p.agente];
                    return (
                      <button
                        key={p.id}
                        onClick={() => onOpenProcess(p)}
                        className="group block w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-indigo-700">{p.nome}</span>
                          {p.canal && <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CANAL_DOT[p.canal]}`} title={`Canal ${p.canal}`} />}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{p.resumo}</p>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${meta.tone}`}>{meta.label}</span>
                          <span className="font-mono text-[10px] text-slate-300">{p.quando}</span>
                        </div>
                      </button>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-300">vazio</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
