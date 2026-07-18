import React, { useState } from 'react';
import {
  ArrowUp,
  Calculator,
  ChevronRight,
  FileCheck2,
  FileSearch,
  Gauge,
  History,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  Truck,
  XCircle
} from 'lucide-react';
import type { TaskId } from '../types';

interface HomeProps {
  aiStatus: 'idle' | 'success' | 'simulated';
  onOpenTask: (taskId: TaskId) => void;
  onRunCommand: (command: string) => void;
}

interface TaskCard {
  id: TaskId;
  label: string;
  description: string;
  icon: React.ReactNode;
  available?: boolean;
}

interface IntentGroup {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tone: string;
  tasks: TaskCard[];
}

const INTENT_GROUPS: IntentGroup[] = [
  {
    eyebrow: '01',
    title: 'Validar uma operação',
    description: 'Encontre bloqueios antes do registro da operação.',
    icon: <ShieldCheck className="h-5 w-5" />,
    tone: 'bg-rose-50 text-rose-700 ring-rose-100',
    tasks: [
      { id: 'audit', label: 'Auditar documentos', description: 'Invoice, BL e documentos comerciais', icon: <FileCheck2 className="h-4 w-4" /> },
      { id: 'risk', label: 'Analisar risco aduaneiro', description: 'Score, bloqueios e plano de ação', icon: <Gauge className="h-4 w-4" /> },
      { id: 'checklist', label: 'Checklist de embarque', description: 'Organize os próximos passos', icon: <Ship className="h-4 w-4" />, available: false }
    ]
  },
  {
    eyebrow: '02',
    title: 'Calcular custos',
    description: 'Projete o impacto financeiro antes de importar.',
    icon: <Calculator className="h-5 w-5" />,
    tone: 'bg-amber-50 text-amber-700 ring-amber-100',
    tasks: [
      { id: 'landedCost', label: 'Calcular custo de importação', description: 'Impostos, câmbio, frete e margem', icon: <Calculator className="h-4 w-4" /> },
      { id: 'freight', label: 'Calcular frete', description: 'Compare custos de transporte', icon: <Truck className="h-4 w-4" />, available: false },
      { id: 'margin', label: 'Simular margem', description: 'Viabilidade e preço alvo', icon: <Sparkles className="h-4 w-4" />, available: false }
    ]
  },
  {
    eyebrow: '03',
    title: 'Consultar informações',
    description: 'Responda dúvidas técnicas em poucos segundos.',
    icon: <Search className="h-5 w-5" />,
    tone: 'bg-sky-50 text-sky-700 ring-sky-100',
    tasks: [
      { id: 'classify', label: 'Classificar produto', description: 'Sugestão de NCM com justificativa', icon: <FileSearch className="h-4 w-4" /> },
      { id: 'ncm', label: 'Consultar NCM', description: 'Regras, órgãos e alíquotas', icon: <Search className="h-4 w-4" />, available: false },
      { id: 'antidumping', label: 'Verificar antidumping', description: 'Origem, tarifa e vigência', icon: <XCircle className="h-4 w-4" />, available: false }
    ]
  }
];

const RECENT_ITEMS = [
  { title: 'Invoice Cosmetics Korea', type: 'Auditoria documental', result: 'Risco 72%', time: 'Agora' },
  { title: 'Stanley Mug China', type: 'Análise de risco', result: '2 bloqueios', time: 'Ontem' },
  { title: 'Resina Epóxi EUA', type: 'Custo de importação', result: 'Simulação', time: '12 jun' }
];

export default function Home({ aiStatus, onOpenTask, onRunCommand }: HomeProps) {
  const [command, setCommand] = useState('');

  const submitCommand = (event: React.FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    setCommand('');
    onRunCommand(value);
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#f7f8fa]" id="home-view">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Centro de operações
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">O que você precisa resolver hoje?</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Escolha uma intenção ou descreva a operação. O ComexPilot organiza a análise e abre o workspace certo para você.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-500 shadow-sm sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${aiStatus === 'simulated' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {aiStatus === 'simulated' ? 'Motor local ativo' : 'Motor AI ativo'}
          </div>
        </header>

        <form onSubmit={submitCommand} className="mt-7 flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-[0_12px_32px_rgba(15,23,42,0.06)] focus-within:border-slate-500">
          <Sparkles className="ml-2 h-5 w-5 shrink-0 text-indigo-500" />
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Descreva uma operação, documento ou dúvida..." className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
          <button type="submit" disabled={!command.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-indigo-700 disabled:opacity-25" title="Abrir comando">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-9 grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Comece por um objetivo</p>
                <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Tarefas por intenção</h2>
              </div>
              <span className="hidden text-xs text-slate-400 sm:block">{INTENT_GROUPS.length} caminhos principais</span>
            </div>

            <div className="space-y-3">
              {INTENT_GROUPS.map((group) => (
                <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 ${group.tone}`}>{group.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-300">{group.eyebrow}</span>
                        <h3 className="font-display text-base font-semibold text-slate-900">{group.title}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {group.tasks.map((task) => (
                      <button key={task.id} onClick={() => task.available !== false && onOpenTask(task.id)} disabled={task.available === false} className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50 disabled:cursor-default disabled:opacity-55">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 group-hover:text-indigo-600">{task.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-slate-800">{task.label}</span>
                          <span className="mt-1 block text-[11px] leading-snug text-slate-400">{task.description}</span>
                          {task.available === false && <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-slate-400">Em breve</span>}
                        </span>
                        {task.available !== false && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Atividade</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">Histórico recente</h2>
              </div>
              <History className="h-4 w-4 text-slate-300" />
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {RECENT_ITEMS.map((item) => (
                <button key={item.title} className="group flex w-full items-start gap-3 py-3 text-left first:pt-0 last:pb-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400 ring-4 ring-indigo-50" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800 group-hover:text-indigo-700">{item.title}</span>
                    <span className="mt-1 block text-[11px] text-slate-400">{item.type} · {item.result}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-300">{item.time}</span>
                </button>
              ))}
            </div>
            <button className="mt-5 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-800">Ver histórico completo <ChevronRight className="h-3.5 w-3.5" /></button>
          </aside>
        </div>
      </div>
    </main>
  );
}
