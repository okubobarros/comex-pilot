/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dock de Agentes (estilo SO). Cada ícone é um agente invocável isoladamente
 * (roteamento dinâmico simulado no front — PRD §4.0). Clicar carrega o agente
 * na Área de Trabalho sem recarregar a página.
 *
 * Fica no FLUXO do layout (não `fixed`): assim ocupa espaço próprio no rodapé
 * do shell e nunca sobrepõe os botões do chat ou do canvas.
 */
import React from 'react';
import { Calculator, FileText, MessageCircle, Network, Scale, Target } from 'lucide-react';

export type AgentId = 'audit' | 'costing' | 'ncm' | 'compliance' | 'li' | 'chat';

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
  { id: 'compliance', label: 'Conformidade', camada: 'Anuência (SAT-Graph)', icon: <Network className="h-5 w-5" /> },
  { id: 'li', label: 'Gerador de LI', camada: 'Justificativa + Ação', icon: <FileText className="h-5 w-5" /> },
  { id: 'chat', label: 'Assistente Geral', camada: 'Dúvidas avulsas', icon: <MessageCircle className="h-5 w-5" /> },
];

interface AgentDockProps {
  active: AgentId | null;
  onSelect: (id: AgentId) => void;
}

export default function AgentDock({ active, onSelect }: AgentDockProps) {
  return (
    <div className="z-30 flex shrink-0 justify-center border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur" id="os-agent-dock">
      <div className="flex items-end gap-1.5">
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
