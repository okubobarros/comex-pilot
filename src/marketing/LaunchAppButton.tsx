/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Botão de entrada no produto, reusado em todos os CTAs da landing page.
 *
 * É um `<a href="/app">` de verdade, não um `<button onClick>`: preserva o
 * clique do meio, "abrir em nova aba" e o preview do link — e continua
 * funcionando se o JavaScript falhar. O clique normal é interceptado só para
 * trocar de tela sem recarregar o bundle.
 */
import React, { useState } from 'react';
import { CAMINHO_APP, navegarPara } from '../routes';

interface LaunchAppButtonProps {
  label?: string;
  className?: string;
  /** 'primario' = ação principal (esmeralda); 'discreto' = link do header. */
  variante?: 'primario' | 'discreto';
}

export default function LaunchAppButton({
  label = 'Testar Copiloto Agora',
  className = '',
  variante = 'primario',
}: LaunchAppButtonProps) {
  const [saindo, setSaindo] = useState(false);

  const aoClicar = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Deixa passar o que o navegador faz melhor: nova aba, nova janela, download.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setSaindo(true);
    navegarPara(CAMINHO_APP);
  };

  const base =
    'group inline-flex items-center justify-center gap-2 rounded-xl font-semibold '
    + 'transition-all duration-200 active:scale-[0.98] focus-visible:outline-none '
    + 'focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 '
    + 'focus-visible:ring-offset-[#0a0f1d]';

  const estilo =
    variante === 'primario'
      ? 'bg-emerald-500 px-6 py-3.5 text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-emerald-400/30'
      : 'border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 hover:border-emerald-500/60 hover:text-white';

  return (
    <a href={CAMINHO_APP} onClick={aoClicar} className={`${base} ${estilo} ${className}`}>
      <span>{label}</span>
      <svg
        className={`h-5 w-5 transition-transform duration-200 ${saindo ? 'translate-x-1' : 'group-hover:translate-x-1'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </a>
  );
}
