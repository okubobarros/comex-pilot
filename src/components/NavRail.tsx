/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FilePlus2, History, Ship, Settings, Scale } from 'lucide-react';

interface NavRailProps {
  onNewProcess: () => void;
}

const railItem = 'flex h-10 w-10 items-center justify-center rounded-lg transition';

export default function NavRail({ onNewProcess }: NavRailProps) {
  return (
    <nav className="flex h-full w-14 shrink-0 flex-col items-center justify-between border-r border-slate-800 bg-slate-950 py-4" id="nav-rail">
      <div className="flex flex-col items-center gap-1.5">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white" title="ComexPilot">
          <Scale className="h-5 w-5" />
        </div>

        <button
          onClick={onNewProcess}
          title="Novo Processo"
          className={`${railItem} bg-slate-800 text-white hover:bg-slate-700`}
        >
          <FilePlus2 className="h-4.5 w-4.5" />
        </button>
        <button title="Histórico de Auditorias" className={`${railItem} text-slate-500 hover:bg-slate-800 hover:text-slate-200`}>
          <History className="h-4.5 w-4.5" />
        </button>
        <button title="Agentes de Carga" className={`${railItem} text-slate-500 hover:bg-slate-800 hover:text-slate-200`}>
          <Ship className="h-4.5 w-4.5" />
        </button>
        <button title="Configurações" className={`${railItem} text-slate-500 hover:bg-slate-800 hover:text-slate-200`}>
          <Settings className="h-4.5 w-4.5" />
        </button>
      </div>

      <button
        title="Okubo Barros"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
      >
        OB
      </button>
    </nav>
  );
}
