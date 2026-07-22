/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Trilha de evidências do último agente que agiu (pilares Confiança/Clareza do
 * PRD). Guarda o "chain of thought" (passos do raciocínio) e as citações
 * normativas. O Painel de Evidências consome isto. Nenhuma recomendação deve
 * aparecer sem justificativa + citação — este contexto é onde isso vive.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AgentId } from '../components/os/AgentDock';

export interface Citation {
  /** Identificação da norma (bate com mcat.norma.identificacao). Ex.: "LC 214/2025". */
  ref: string;
  /** Rótulo curto opcional para exibição. */
  nota?: string;
}

export interface Evidence {
  agent: AgentId;
  titulo: string;
  steps: string[];
  citations: Citation[];
}

interface EvidenceContextValue {
  evidence: Evidence | null;
  setEvidence: (e: Evidence | null) => void;
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null);

export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const value = useMemo(() => ({ evidence, setEvidence }), [evidence]);
  return <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>;
}

export function useEvidence(): EvidenceContextValue {
  const ctx = useContext(EvidenceContext);
  if (!ctx) throw new Error('useEvidence deve ser usado dentro de <EvidenceProvider>');
  return ctx;
}
