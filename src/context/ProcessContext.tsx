/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Estado global dos Processos ativos (entidade Processo do PRD). Alimenta o
 * Kanban do Centro de Operações. São dados operacionais de demonstração —
 * quando o backend persistir processos reais (tabela mcat.processo), esta fonte
 * passa a ler de lá. A estrutura já espelha as colunas/entidades do PRD.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AgentId } from '../components/os/AgentDock';

export type ProcStatus = 'pendente' | 'em_analise' | 'concluido';
export type Canal = 'verde' | 'amarelo' | 'vermelho';

export interface Processo {
  id: string;
  nome: string;
  agente: AgentId;
  status: ProcStatus;
  canal?: Canal;
  quando: string;
  resumo: string;
}

const DEMO: Processo[] = [
  { id: 'p-1', nome: 'Invoice Cosméticos Coreia', agente: 'audit', status: 'em_analise', canal: 'vermelho', quando: 'há 4 min', resumo: 'Risco 72% · 2 bloqueios (ANVISA, subfaturamento)' },
  { id: 'p-2', nome: 'Antidumping Stanley China', agente: 'audit', status: 'em_analise', canal: 'amarelo', quando: 'há 22 min', resumo: 'Direitos antidumping ativos · NCM 9617.00.10' },
  { id: 'p-3', nome: 'Custeio Resina Epóxi', agente: 'costing', status: 'pendente', quando: 'há 1 h', resumo: 'Aguardando câmbio PTAX · FOB US$ 45.000' },
  { id: 'p-4', nome: 'Custeio Tumblers China', agente: 'costing', status: 'pendente', quando: 'há 2 h', resumo: '5.000 un · Santos (SP) · a calcular' },
  { id: 'p-5', nome: 'Minuta LI · Gel Aloe Vera', agente: 'li', status: 'concluido', canal: 'verde', quando: 'ontem', resumo: 'XML Siscomex + Termo ANVISA gerados' },
  { id: 'p-6', nome: 'Classificação · Drone Wi-Fi', agente: 'ncm', status: 'concluido', canal: 'amarelo', quando: 'ontem', resumo: 'NCM 8806.92.00 · homologação ANATEL' },
];

interface ProcessContextValue {
  processos: Processo[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

const ProcessContext = createContext<ProcessContextValue | null>(null);

export function ProcessProvider({ children }: { children: React.ReactNode }) {
  const [processos] = useState<Processo[]>(DEMO);
  const [activeId, setActiveId] = useState<string | null>(null);
  const value = useMemo(() => ({ processos, activeId, setActiveId }), [processos, activeId]);
  return <ProcessContext.Provider value={value}>{children}</ProcessContext.Provider>;
}

export function useProcessos(): ProcessContextValue {
  const ctx = useContext(ProcessContext);
  if (!ctx) throw new Error('useProcessos deve ser usado dentro de <ProcessProvider>');
  return ctx;
}
