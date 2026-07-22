/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dock de Agentes (estilo SO). Cada ícone é um agente invocável isoladamente
 * (roteamento dinâmico simulado no front — PRD §4.0). Clicar carrega o agente
 * na Área de Trabalho sem recarregar a página.
 */
import React from 'react';
import { Calculator, FileText, MessageCircle, Scale, Target } from 'lucide-react';

export type AgentId = 'audit' | 'costing' | 'ncm' | 'li' | 'chat';

interface AgentDef {
  id: AgentId;
  label: string;
  camada: string;
  icon: React.ReactNode;
}

const AGENTS: AgentDef[] = [
  { id: 'audit', label: 'Auditor', camada: 'Extração + Conciliação', icon: <Target className="h-5 w-5" /> },
  { id: 'costing', label: 'Custeio', camada: 'Landed Cost', icon: <Calculator className="h-5 w-5" /> },
  { id: 'ncm', label: 'Classificador NCM', camada: 'Raciocínio Regulatório', icon: <Scale className="h-5 w-5" /> },
  { id: 'li', label: 'Gerador de LI', camada: 'Justificativa + Ação', icon: <FileText className="h-5 w-5" /> },
  { id: 'chat', label: 'Assistente Geral', camada: 'Dúvidas avulsas', icon: <MessageCircle className="h-5 w-5" /> },
];

interface AgentDockProps {
  active: AgentId | null;
  onSelect: (id: AgentId) => void;
}

export default function AgentDock({ active, onSelect }: AgentDockProps) {
  return (
    <div className="pointer-events-none fixed bottom-3 right-4 z-40 flex justify-end lg:right-[19rem]" id="os-agent-dock">
      <div className="pointer-events-auto flex items-end gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur">
        {AGENTS.map((a) => {
          const isActive = active === a.id;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              title={`${a.label} — ${a.camada}`}
              className={`group flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {a.icon}
              <span className={`text-[9px] font-semibold ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`}>{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
