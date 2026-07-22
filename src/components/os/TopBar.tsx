/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top Bar do "OS Shell": cliente ativo, Time Machine (data de vigência da
 * Reforma) e indicador de Confiança do Sistema. O seletor de data alimenta o
 * DateContext — mudar a fase recalcula os impostos com dados reais versionados.
 */
import React from 'react';
import { AlertTriangle, ChevronDown, Clock, ShieldCheck } from 'lucide-react';
import Logo from '../Logo';
import { useReformaDate } from '../../context/DateContext';

interface TopBarProps {
  cliente?: string;
  confianca?: number; // 0..100
}

export default function TopBar({ cliente = 'ComexPilot · Operação Demo', confianca = 92 }: TopBarProps) {
  const { fases, fase, setFaseId } = useReformaDate();
  const confColor = confianca >= 80 ? 'text-emerald-600' : confianca >= 50 ? 'text-amber-600' : 'text-rose-600';
  const confDot = confianca >= 80 ? 'bg-emerald-500' : confianca >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4" id="os-topbar">
      {/* Cliente */}
      <div className="flex min-w-0 items-center gap-2">
        <Logo className="h-6 w-6 shrink-0" />
        <span className="truncate text-xs font-semibold text-slate-700">{cliente}</span>
      </div>

      {/* Time Machine */}
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:flex">
          <Clock className="h-3.5 w-3.5" /> Vigência
        </div>
        <div className="relative">
          <select
            value={fase.id}
            onChange={(e) => setFaseId(e.target.value)}
            title="Data de vigência da Reforma Tributária (fato gerador)"
            className="appearance-none rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-800 outline-none transition hover:border-indigo-400 focus:border-indigo-500"
            id="time-machine-select"
          >
            {fases.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        {fase.provisional && (
          <span className="hidden items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 sm:inline-flex" title={fase.hint}>
            <AlertTriangle className="h-3 w-3" /> provisório
          </span>
        )}
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
