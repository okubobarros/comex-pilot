/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Navegação lateral organizada por VALOR PARA O USUÁRIO (padrão RegTech), não
 * por funcionalidade técnica: Painel → Conformidade & Risco → Financeiro →
 * Processos.
 *
 * Só entram itens que abrem uma workspace real. Nada de "em breve": link que
 * não faz nada é ruído na navegação e custa confiança numa ferramenta de
 * conformidade.
 */
import React, { useState } from 'react';
import {
  Calculator, FileSearch, Home as HomeIcon, KanbanSquare,
  Scale, Settings, ShieldAlert,
} from 'lucide-react';
import Logo from './Logo';
import type { AppView, TaskId } from '../types';

interface NavRailProps {
  activeView: AppView;
  onNavigateHome: () => void;
  onOpenTask: (taskId: TaskId) => void;
  /** Tarefa ativa no canvas, para destacar o item correspondente. */
  activeTask?: TaskId | null;
}

interface RailItem {
  id: TaskId | 'home' | 'kanban';
  label: string;
  hint: string;
  icon: React.ReactNode;
}

interface RailSection {
  titulo: string;
  itens: RailItem[];
}

const SECOES: RailSection[] = [
  {
    titulo: 'Painel',
    itens: [{ id: 'home', label: 'Home', hint: 'Copiloto', icon: <HomeIcon className="h-4 w-4" /> }],
  },
  {
    titulo: 'Conformidade & Risco',
    itens: [
      { id: 'audit', label: 'Auditar Documentos', hint: 'Invoice / BL', icon: <FileSearch className="h-4 w-4" /> },
      { id: 'classify', label: 'Classificação NCM', hint: 'Graph-RAG', icon: <Scale className="h-4 w-4" /> },
      { id: 'compliance', label: 'Risco & LPCO', hint: 'Órgãos anuentes', icon: <ShieldAlert className="h-4 w-4" /> },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { id: 'landedCost', label: 'Custo de Importação', hint: 'Landed Cost', icon: <Calculator className="h-4 w-4" /> },
    ],
  },
  {
    titulo: 'Processos',
    itens: [
      { id: 'kanban', label: 'Gestão de Processos', hint: 'Kanban', icon: <KanbanSquare className="h-4 w-4" /> },
    ],
  },
];

export default function NavRail({ activeView, onNavigateHome, onOpenTask, activeTask }: NavRailProps) {
  const [expanded, setExpanded] = useState(false);

  const acionar = (item: RailItem) => {
    if (item.id === 'home') return onNavigateHome();
    if (item.id === 'kanban') {
      // O Kanban vive na Home: navega e rola até o pipeline.
      onNavigateHome();
      requestAnimationFrame(() =>
        document.getElementById('pipeline-processos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      return;
    }
    onOpenTask(item.id as TaskId);
  };

  const estaAtivo = (item: RailItem) =>
    item.id === 'home' || item.id === 'kanban'
      ? activeView === 'home'
      : activeView === 'workspace' && activeTask === item.id;

  const labelClass = `min-w-0 overflow-hidden text-left transition-all duration-200 ${
    expanded ? 'ml-3 max-w-[150px] opacity-100' : 'ml-0 max-w-0 opacity-0'
  }`;

  return (
    <nav
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`z-30 flex h-full shrink-0 flex-col border-r border-slate-800 bg-slate-950 py-4 transition-all duration-300 ease-in-out ${
        expanded ? 'w-60 px-3' : 'w-14 px-2'
      }`}
      id="nav-rail"
    >
      {/* Marca */}
      <button onClick={onNavigateHome} className="mb-5 flex h-10 w-full items-center rounded-lg px-2.5" title="ComexPilot">
        <Logo className="h-9 w-9 shrink-0" />
        <span
          className={`overflow-hidden whitespace-nowrap font-display font-semibold tracking-tight text-white transition-all duration-200 ${
            expanded ? 'ml-3 max-w-[150px] opacity-100' : 'ml-0 max-w-0 opacity-0'
          }`}
        >
          ComexPilot
        </span>
      </button>

      {/* Seções — a lista inteira cabe sem scroll */}
      <div className="flex-1 space-y-4">
        {SECOES.map((secao) => (
          <div key={secao.titulo}>
            {/* Título só quando expandido; recolhido, um separador mantém o agrupamento legível */}
            {expanded ? (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {secao.titulo}
              </p>
            ) : (
              <div className="mx-auto mb-1.5 h-px w-6 bg-slate-800" />
            )}
            <div className="space-y-0.5">
              {secao.itens.map((item) => {
                const ativo = estaAtivo(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => acionar(item)}
                    title={expanded ? undefined : `${item.label} — ${item.hint}`}
                    className={`flex h-10 w-full items-center rounded-lg px-2.5 transition ${
                      ativo ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className={labelClass}>
                      <span className="block truncate text-xs font-medium leading-tight">{item.label}</span>
                      <span className={`block truncate text-[10px] leading-tight ${ativo ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {item.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        className={`flex items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 ${
          expanded ? 'w-full px-2.5 py-2' : 'justify-center py-2'
        }`}
        title={expanded ? undefined : 'Configurações'}
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span
          className={`overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-200 ${
            expanded ? 'ml-3 max-w-[150px] opacity-100' : 'ml-0 max-w-0 opacity-0'
          }`}
        >
          Configurações
        </span>
      </button>
    </nav>
  );
}
