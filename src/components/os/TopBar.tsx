/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top Bar do "OS Shell": identificação do ambiente/operação e indicador de
 * Confiança do Sistema. Sem logo: a marca aparece uma única vez, na Sidebar.
 */
import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface TopBarProps {
  cliente?: string;
  confianca?: number; // 0..100
}

export default function TopBar({ cliente = 'Operação Demo', confianca = 92 }: TopBarProps) {
  const confColor = confianca >= 80 ? 'text-emerald-600' : confianca >= 50 ? 'text-amber-600' : 'text-rose-600';
  const confDot = confianca >= 80 ? 'bg-emerald-500' : confianca >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4" id="os-topbar">
      {/* Ambiente/operação — a marca ComexPilot vive só na Sidebar, para não duplicar */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-xs font-semibold text-slate-700">{cliente}</span>
      </div>

      {/* Confiança do Sistema */}
      <div className="flex items-center gap-1.5" title="Confiança agregada das recomendações do sistema">
        <ShieldCheck className={`h-4 w-4 ${confColor}`} />
        <span className="hidden text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:inline">Confiança</span>
        <span className={`flex items-center gap-1 font-mono text-xs font-semibold ${confColor}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${confDot}`} />{confianca}%
        </span>
      </div>
    </header>
  );
}
