import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileCheck2, History, Home as HomeIcon, PlaySquare, Settings, ShieldCheck, Ship, SquareMenu } from 'lucide-react';
import Logo from './Logo';
import type { AppView, TaskId } from '../types';

interface NavRailProps {
  activeView: AppView;
  onNavigateHome: () => void;
  onOpenTask: (taskId: TaskId) => void;
}

interface RailTask {
  id: TaskId;
  label: string;
  available?: boolean;
}

interface TaskGroup {
  label: string;
  icon: React.ReactNode;
  tasks: RailTask[];
}

const TASK_GROUPS: TaskGroup[] = [
  { label: 'Validar operação', icon: <ShieldCheck className="h-3.5 w-3.5" />, tasks: [{ id: 'audit', label: 'Auditar documentos' }, { id: 'risk', label: 'Analisar risco' }, { id: 'checklist', label: 'Checklist de embarque', available: false }] },
  { label: 'Calcular custos', icon: <SquareMenu className="h-3.5 w-3.5" />, tasks: [{ id: 'landedCost', label: 'Custo de importação' }, { id: 'freight', label: 'Calcular frete', available: false }, { id: 'margin', label: 'Simular margem', available: false }] },
  { label: 'Consultar informações', icon: <FileCheck2 className="h-3.5 w-3.5" />, tasks: [{ id: 'classify', label: 'Classificar produto' }, { id: 'ncm', label: 'Consultar NCM', available: false }, { id: 'antidumping', label: 'Verificar antidumping', available: false }] }
];

export default function NavRail({ activeView, onNavigateHome, onOpenTask }: NavRailProps) {
  const [expanded, setExpanded] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ 'Validar operação': true });

  const toggleGroup = (label: string) => setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  const labelClass = `overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-200 ${expanded ? 'ml-3 max-w-[150px] opacity-100' : 'ml-0 max-w-0 opacity-0'}`;

  return (
    <nav onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)} onClick={() => { if (!expanded) setExpanded(true); }} className={`z-30 flex h-full shrink-0 flex-col border-r border-slate-800 bg-slate-950 py-4 transition-all duration-300 ease-in-out ${expanded ? 'w-60 px-3' : 'w-14 px-2'}`} id="nav-rail">
      <div className="min-h-0 flex-1 overflow-hidden">
        <button onClick={onNavigateHome} className="mb-5 flex h-10 w-full items-center rounded-lg px-2.5" title="ComexPilot">
          <Logo className="h-9 w-9 shrink-0" />
          <span className={`font-display font-semibold tracking-tight text-white ${labelClass}`}>ComexPilot</span>
        </button>

        <div className="space-y-1">
          <button onClick={onNavigateHome} className={`flex h-10 w-full items-center rounded-lg px-2.5 transition ${activeView === 'home' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`} title={expanded ? undefined : 'Home'}>
            <HomeIcon className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Home</span>
          </button>
          <button onClick={() => setTasksOpen((current) => !current)} className="flex h-10 w-full items-center rounded-lg px-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200" title={expanded ? undefined : 'Tarefas'}>
            <PlaySquare className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Tarefas</span>
            {expanded && (tasksOpen ? <ChevronDown className="ml-auto h-3.5 w-3.5" /> : <ChevronRight className="ml-auto h-3.5 w-3.5" />)}
          </button>
        </div>

        {expanded && tasksOpen && (
          <div className="mt-1 max-h-[min(52vh,430px)] space-y-1 overflow-y-auto border-l border-slate-800 pl-2">
            {TASK_GROUPS.map((group) => (
              <div key={group.label}>
                <button onClick={() => toggleGroup(group.label)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] font-semibold text-slate-400 transition hover:bg-slate-900 hover:text-slate-200">
                  {group.icon}
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  {openGroups[group.label] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                {openGroups[group.label] && <div className="mb-1 space-y-0.5 pl-2">{group.tasks.map((task) => <button key={task.id} disabled={task.available === false} onClick={() => task.available !== false && onOpenTask(task.id)} className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] text-slate-500 transition hover:bg-slate-900 hover:text-slate-200 disabled:cursor-default disabled:text-slate-700">{task.label}{task.available === false && <span className="ml-1 text-[9px] uppercase">· em breve</span>}</button>)}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 space-y-1">
          <button className="flex h-10 w-full items-center rounded-lg px-2.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200" title={expanded ? undefined : 'Histórico'}>
            <History className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Histórico</span>
          </button>
          <button className="flex h-10 w-full items-center rounded-lg px-2.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200" title={expanded ? undefined : 'Automações'}>
            <PlaySquare className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Automações</span>
          </button>
          <button className="flex h-10 w-full items-center rounded-lg px-2.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200" title={expanded ? undefined : 'Agentes'}>
            <Ship className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Agentes</span>
          </button>
        </div>
      </div>

      <button className={`flex items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 ${expanded ? 'w-full px-2 py-2' : 'justify-center py-1'}`} title={expanded ? undefined : 'Configurações'}>
        <Settings className="h-4 w-4 shrink-0" />
        <span className={labelClass}>Configurações</span>
      </button>
    </nav>
  );
}
