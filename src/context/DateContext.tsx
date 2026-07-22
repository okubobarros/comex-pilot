/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Time Machine" da Reforma Tributária. Guarda a data de vigência selecionada
 * (fato gerador) e a expõe globalmente. As alíquotas NÃO vivem aqui — são
 * resolvidas no backend (`/api/costing`) a partir da tabela versionada
 * `mcat.ibs_cbs_regra`, usando a data escolhida. Assim o seletor é dado real,
 * não mock: mudar a fase muda o que o motor lê.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';

export interface ReformaFase {
  id: string;
  label: string;
  /** Data de fato gerador enviada ao backend (YYYY-MM-DD). */
  date: string;
  /** true = alíquotas ainda provisórias (a validar com tributarista). */
  provisional: boolean;
  hint: string;
}

export const FASES: ReformaFase[] = [
  { id: '2026', label: 'Jan/2026 · Teste', date: '2026-06-01', provisional: false, hint: 'CBS 0,9% + IBS 0,1% — compensáveis (impacto de caixa zero).' },
  { id: '2027', label: 'Jan/2027 · CBS cheia', date: '2027-06-01', provisional: true, hint: 'PIS/COFINS extintos, IPI zerado (exceto ZFM), CBS cheia.' },
  { id: '2029', label: 'Jan/2029 · Transição', date: '2029-06-01', provisional: true, hint: 'ICMS −10%/ano, IBS sobe na mesma proporção.' },
  { id: '2033', label: 'Jan/2033 · Definitivo', date: '2033-06-01', provisional: true, hint: 'Regime definitivo IBS/CBS pleno.' },
];

interface DateContextValue {
  fases: ReformaFase[];
  fase: ReformaFase;
  setFaseId: (id: string) => void;
  /** Atalho: data de fato gerador da fase ativa (YYYY-MM-DD). */
  dataFatoGerador: string;
}

const DateContext = createContext<DateContextValue | null>(null);

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [faseId, setFaseId] = useState<string>(FASES[0].id);
  const value = useMemo<DateContextValue>(() => {
    const fase = FASES.find((f) => f.id === faseId) ?? FASES[0];
    return { fases: FASES, fase, setFaseId, dataFatoGerador: fase.date };
  }, [faseId]);
  return <DateContext.Provider value={value}>{children}</DateContext.Provider>;
}

export function useReformaDate(): DateContextValue {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error('useReformaDate deve ser usado dentro de <DateProvider>');
  return ctx;
}
