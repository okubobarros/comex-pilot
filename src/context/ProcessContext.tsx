/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Estado global dos Processos ativos (entidade Processo do PRD). Alimenta o
 * Kanban do Centro de Operações.
 *
 * Começa VAZIO. Antes vinha com seis processos de demonstração que pareciam
 * operações reais em andamento — num produto de conformidade, um pipeline
 * povoado por ficção é indistinguível de um pipeline de verdade.
 *
 * Cada processo aqui nasce de uma ação que o usuário efetivamente executou.
 * Vive em memória; quando o backend persistir (tabela mcat.processo), esta
 * fonte passa a ler de lá sem mudar a interface.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AgentId } from '../components/os/AgentDock';

export type ProcStatus = 'pendente' | 'em_analise' | 'concluido';
export type Canal = 'verde' | 'amarelo' | 'vermelho';

/** Resultado de uma consulta de conformidade, preservado entre navegações. */
export interface ConformidadeSnapshot {
  ncm: { codigo?: string; descricao?: string };
  tratamentos: Record<string, unknown>[];
  total_orgaos: number;
  consultadoEm: string;
}

export interface Processo {
  id: string;
  nome: string;
  agente: AgentId;
  status: ProcStatus;
  canal?: Canal;
  quando: string;
  resumo: string;
}


interface ProcessContextValue {
  processos: Processo[];
  /** Registra um processo a partir de uma ação real do usuário. */
  registrarProcesso: (p: Omit<Processo, 'id' | 'quando'>) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  /** Última consulta de conformidade — sobrevive à troca de agente no Dock. */
  conformidade: ConformidadeSnapshot | null;
  setConformidade: (s: ConformidadeSnapshot | null) => void;
}

const ProcessContext = createContext<ProcessContextValue | null>(null);

export function ProcessProvider({ children }: { children: React.ReactNode }) {
  const [processos, setProcessos] = useState<Processo[]>([]);

  const registrarProcesso = (p: Omit<Processo, 'id' | 'quando'>) => {
    setProcessos((prev) => [
      { ...p, id: `p-${Date.now()}-${prev.length}`, quando: 'agora' },
      ...prev,
    ]);
  };
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conformidade, setConformidade] = useState<ConformidadeSnapshot | null>(null);
  const value = useMemo(
    () => ({ processos, registrarProcesso, activeId, setActiveId, conformidade, setConformidade }),
    [processos, activeId, conformidade]
  );
  return <ProcessContext.Provider value={value}>{children}</ProcessContext.Provider>;
}

export function useProcessos(): ProcessContextValue {
  const ctx = useContext(ProcessContext);
  if (!ctx) throw new Error('useProcessos deve ser usado dentro de <ProcessProvider>');
  return ctx;
}
