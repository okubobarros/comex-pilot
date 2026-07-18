/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FilePlus2, History, Ship, Settings } from 'lucide-react';
import Logo from './Logo';

interface NavRailProps {
  onNewProcess: () => void;
}

interface RailItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export default function NavRail({ onNewProcess }: NavRailProps) {
  const [expanded, setExpanded] = useState(false);

  const items: RailItem[] = [
    { label: 'Novo Processo', icon: <FilePlus2 className="h-4.5 w-4.5 shrink-0" />, onClick: onNewProcess, active: true },
    { label: 'Histórico de Auditorias', icon: <History className="h-4.5 w-4.5 shrink-0" /> },
    { label: 'Agentes de Carga', icon: <Ship className="h-4.5 w-4.5 shrink-0" /> },
    { label: 'Configurações', icon: <Settings className="h-4.5 w-4.5 shrink-0" /> }
  ];

  const labelClass = `overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-300 ${
    expanded ? 'ml-3 max-w-[140px] opacity-100' : 'ml-0 max-w-0 opacity-0'
  }`;

  return (
    <nav
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => { if (!expanded) setExpanded(true); }}
      className={`flex h-full shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-950 py-4 transition-all duration-300 ease-in-out ${
        expanded ? 'w-56 px-3' : 'w-14 px-2'
      }`}
      id="nav-rail"
    >
      <div className="flex flex-col gap-1.5">
        {/* Brand */}
        <div className="mb-4 flex h-10 items-center" title="ComexPilot">
          <Logo className="h-9 w-9 shrink-0" />
          <span className={`font-display font-semibold tracking-tight text-white ${labelClass}`}>
            ComexPilot
          </span>
        </div>

        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            title={expanded ? undefined : item.label}
            className={`flex h-10 w-full items-center rounded-lg px-2.5 transition ${
              item.active
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {item.icon}
            <span className={labelClass}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* User profile */}
      <button
        title={expanded ? undefined : 'Okubo Barros'}
        className={`flex items-center rounded-lg transition hover:bg-slate-800 ${expanded ? 'px-2 py-2' : 'justify-center py-1'}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
          OB
        </span>
        <span className={`flex flex-col items-start ${labelClass}`}>
          <span className="text-xs font-medium text-slate-200">Okubo Barros</span>
          <span className="text-[10px] text-slate-500">Analista Aduaneiro</span>
        </span>
      </button>
    </nav>
  );
}
