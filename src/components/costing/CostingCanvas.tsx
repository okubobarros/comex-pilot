/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canvas de Custeio (PRD §4 / mock 06.png): split em 3 linhas —
 *   1) Dados brutos (OCR/texto colado)
 *   2) Sugestão estruturada (campos preenchidos pela IA em AMARELO)
 *   3) Reconciliação (divergências declarado × calculado, com "Aceitar sugestão")
 * Aparece após a extração assistida, acima do formulário passo-a-passo.
 */
import React from 'react';
import { Check, FileText, Sparkles, TriangleAlert } from 'lucide-react';
import { LandedCostInputs } from '../../types';
import type { CostingRates } from '../../engine/costing';

interface CostingCanvasProps {
  rawText: string;
  inputs: LandedCostInputs;
  rates: CostingRates | null;
  aiFilled: Set<string>;
  onAcceptFreight: (usd: number) => void;
}

const pct = (v?: number) => (v == null ? '—' : `${v}%`);

export default function CostingCanvas({ rawText, inputs, rates, aiFilled, onAcceptFreight }: CostingCanvasProps) {
  // Linha 2 — campos estruturados sugeridos. `ia` marca origem IA/motor (amarelo).
  const campos: { k: string; label: string; valor: string; ia: boolean }[] = [
    { k: 'ncm', label: 'NCM', valor: inputs.ncm || '—', ia: aiFilled.has('ncm') },
    { k: 'ii', label: 'II', valor: pct(rates?.iiPct), ia: !!rates },
    { k: 'ipi', label: 'IPI', valor: pct(rates?.ipiPct), ia: !!rates },
    { k: 'pis', label: 'PIS', valor: pct(rates?.pisPct), ia: !!rates },
    { k: 'cofins', label: 'COFINS', valor: pct(rates?.cofinsPct), ia: !!rates },
    { k: 'icms', label: 'ICMS', valor: pct(rates?.icmsPct), ia: !!rates },
    { k: 'cbs', label: 'CBS', valor: pct(rates?.reforma.cbsPct), ia: !!rates },
    { k: 'ibs', label: 'IBS', valor: pct(rates?.reforma.ibsPct), ia: !!rates },
  ];

  // Linha 3 — reconciliação de frete: declarado × estimativa por rota (proxy ~12% do FOB).
  const freteDeclarado = inputs.freightUsd;
  const freteRota = Math.round(inputs.fobUsd * 0.12);
  const base = Math.max(freteRota, freteDeclarado, 1);
  const divergencia = Math.round((Math.abs(freteRota - freteDeclarado) / base) * 100);
  const mostrarDivergencia = freteRota > 0 && divergencia >= 5;

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white" id="costing-canvas">
      {/* Linha 1 — Dados brutos */}
      <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <FileText className="h-3 w-3" /> Dados brutos (OCR)
        </div>
        <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-600">
          {rawText.trim() || 'Cole ou arraste a Invoice acima para extrair.'}
        </p>
      </div>

      {/* Linha 2 — Sugestão estruturada */}
      <div className="border-b border-slate-100 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Sparkles className="h-3 w-3 text-indigo-500" /> Sugestão estruturada
          <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700">amarelo = preenchido pela IA</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {campos.map((c) => (
            <div key={c.k} className={`rounded-lg border px-2 py-1.5 ${c.ia ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">{c.label}</span>
              <span className={`font-mono text-xs font-semibold ${c.ia ? 'text-amber-800' : 'text-slate-700'}`}>{c.valor}</span>
            </div>
          ))}
        </div>
        {!rates && <p className="mt-1.5 text-[10px] text-slate-400">As alíquotas aparecem após "Calcular" (resolvidas no banco pelo NCM/UF/data).</p>}
      </div>

      {/* Linha 3 — Reconciliação */}
      <div className="px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <TriangleAlert className="h-3 w-3 text-amber-500" /> Reconciliação
        </div>
        {mostrarDivergencia ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px]">
            <span className="text-amber-800">
              Frete declarado <b>US$ {freteDeclarado.toLocaleString('pt-BR')}</b> · estimativa por rota ({inputs.entryPort}) <b>US$ {freteRota.toLocaleString('pt-BR')}</b> — divergência de <b>{divergencia}%</b>.
            </span>
            <button
              onClick={() => onAcceptFreight(freteRota)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-500"
            >
              <Check className="h-3.5 w-3.5" /> Aceitar sugestão
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
            <Check className="h-3.5 w-3.5" /> Sem divergências relevantes de frete para a rota informada.
          </div>
        )}
      </div>
    </div>
  );
}
