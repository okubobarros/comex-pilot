/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Skill densa "Custeio e Viabilidade (Landed Cost)": formulário assistido por IA
 * em 3 passos que roda no canvas da direita. Aceita colar/arrastar dados brutos
 * de uma Invoice no topo para pré-preencher os campos estruturados.
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, Check, Sparkles, Wand2, X } from 'lucide-react';
import { LandedCostInputs } from '../types';
import { buildHeuristicAnalysis, findRuleForNcm } from '../engine/rulesEngine';
import { DEFAULT_NCM_RULES } from '../data/mockScenarios';

interface LandedCostDrawerProps {
  onClose: () => void;
}

const DEFAULTS: LandedCostInputs = {
  productDescription: '',
  ncm: '',
  origin: 'China',
  fobUsd: 0,
  quantity: 1,
  incoterm: 'FOB',
  entryPort: 'Santos (SP)',
  freightUsd: 0,
  insuranceUsd: 0,
  iiRate: 16,
  ipiRate: 10,
  icmsRate: 18,
  usdBrl: 5.5,
  targetMarginPct: 40
};

const STEPS = ['Produto e Origem', 'Rota Tributária e Portos', 'Margem e Target'];

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function LandedCostDrawer({ onClose }: LandedCostDrawerProps) {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<LandedCostInputs>(DEFAULTS);
  const [rawData, setRawData] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const set = <K extends keyof LandedCostInputs>(key: K, value: LandedCostInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const num = (key: keyof LandedCostInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, (parseFloat(e.target.value) || 0) as LandedCostInputs[typeof key]);

  /** Parsing assistido: extrai o 1º item do texto bruto e pré-preenche os inputs. */
  const runAssistedFill = (text: string) => {
    if (!text.trim()) return;
    const analysis = buildHeuristicAnalysis(text, DEFAULT_NCM_RULES);
    const item = analysis.items[0];
    if (!item) return;
    const rule = findRuleForNcm(item.ncm, DEFAULT_NCM_RULES);
    setInputs((prev) => ({
      ...prev,
      productDescription: item.description,
      ncm: item.ncm,
      origin: item.countryOfOrigin || prev.origin,
      fobUsd: item.totalPrice,
      quantity: item.quantity,
      iiRate: rule?.standardIiRate ?? prev.iiRate
    }));
    setPrefillNote(`Campos pré-preenchidos a partir dos dados brutos: ${item.description} (NCM ${item.ncm}). Ajuste antes de calcular.`);
    setShowResult(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const label = `Invoice anexada: ${file.name}`;
      setRawData(label);
      runAssistedFill(`${file.name} ${label}`);
    }
  };

  // ----- Cálculo do custo de nacionalização (base "por dentro" do ICMS) -----
  const cifUsd = inputs.fobUsd + inputs.freightUsd + inputs.insuranceUsd;
  const cifBrl = cifUsd * inputs.usdBrl;
  const ii = cifBrl * (inputs.iiRate / 100);
  const ipi = (cifBrl + ii) * (inputs.ipiRate / 100);
  const pis = cifBrl * 0.021;
  const cofins = cifBrl * 0.0965;
  const preIcms = cifBrl + ii + ipi + pis + cofins;
  const icmsRateDec = Math.min(inputs.icmsRate / 100, 0.9);
  const icmsBase = preIcms / (1 - icmsRateDec); // gross-up ICMS por dentro
  const icms = icmsBase * icmsRateDec;
  const landedTotal = preIcms + icms;
  const unitCost = inputs.quantity > 0 ? landedTotal / inputs.quantity : 0;
  const suggestedUnitPrice = unitCost * (1 + inputs.targetMarginPct / 100);

  const inputClass = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none';
  const labelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-400';

  return (
    <section className="h-full flex-1 overflow-y-auto bg-slate-100/60" id="landed-cost-drawer">
      <div className="mx-auto max-w-3xl px-6 py-6">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Custeio e Viabilidade Econômica</h2>
              <p className="text-sm text-slate-400">Landed Cost assistido · imposto de importação, IPI, PIS/COFINS e ICMS</p>
            </div>
          </div>
          <button onClick={onClose} title="Fechar skill" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Assisted fill */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mb-5 rounded-xl border border-dashed p-3 transition ${dragOver ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-300 bg-white'}`}
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Wand2 className="h-3.5 w-3.5 text-indigo-500" />
            Preenchimento assistido — arraste uma Invoice ou cole os dados brutos
          </div>
          <textarea
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            placeholder="Ex: 5000 vacuum tumbler mugs, China, FOB 11000 USD..."
            className="h-14 w-full resize-none rounded-lg border border-slate-200 p-2 font-mono text-xs focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => runAssistedFill(rawData)}
            disabled={!rawData.trim()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Extrair e pré-preencher
          </button>
          {prefillNote && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800">
              <Check className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{prefillNote}</span>
            </div>
          )}
        </div>

        {/* Stepper */}
        <div className="mb-5 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  i === step ? 'bg-indigo-600 text-white' : i < step ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i === step ? 'bg-white/25' : i < step ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}>
                  {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200"></div>}
            </React.Fragment>
          ))}
        </div>

        {/* Step body */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Descrição do produto</label>
                <input className={inputClass} value={inputs.productDescription} onChange={(e) => set('productDescription', e.target.value)} placeholder="Ex: Garrafa térmica inox com vácuo" />
              </div>
              <div>
                <label className={labelClass}>NCM</label>
                <input className={`${inputClass} font-mono`} value={inputs.ncm} onChange={(e) => set('ncm', e.target.value)} placeholder="0000.00.00" />
              </div>
              <div>
                <label className={labelClass}>País de origem</label>
                <input className={inputClass} value={inputs.origin} onChange={(e) => set('origin', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Valor FOB total (USD)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.fobUsd || ''} onChange={num('fobUsd')} />
              </div>
              <div>
                <label className={labelClass}>Quantidade (un)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.quantity || ''} onChange={num('quantity')} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Incoterm</label>
                <select className={inputClass} value={inputs.incoterm} onChange={(e) => set('incoterm', e.target.value)}>
                  {['FOB', 'CFR', 'CIF', 'EXW'].map((i) => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Porto / recinto de entrada</label>
                <select className={inputClass} value={inputs.entryPort} onChange={(e) => set('entryPort', e.target.value)}>
                  {['Santos (SP)', 'Paranaguá (PR)', 'Itajaí (SC)', 'Viracopos (SP)', 'Rio de Janeiro (RJ)'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Frete internacional (USD)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.freightUsd || ''} onChange={num('freightUsd')} />
              </div>
              <div>
                <label className={labelClass}>Seguro (USD)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.insuranceUsd || ''} onChange={num('insuranceUsd')} />
              </div>
              <div>
                <label className={labelClass}>Alíquota II (%)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.iiRate || ''} onChange={num('iiRate')} />
              </div>
              <div>
                <label className={labelClass}>Alíquota IPI (%)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.ipiRate || ''} onChange={num('ipiRate')} />
              </div>
              <div>
                <label className={labelClass}>Alíquota ICMS (%)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.icmsRate || ''} onChange={num('icmsRate')} />
              </div>
              <div>
                <label className={labelClass}>Câmbio USD → BRL</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.usdBrl || ''} onChange={num('usdBrl')} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="max-w-xs">
                <label className={labelClass}>Margem alvo sobre o custo (%)</label>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.targetMarginPct || ''} onChange={num('targetMarginPct')} />
              </div>

              <button
                onClick={() => setShowResult(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                <Calculator className="h-4 w-4" />
                Calcular Landed Cost
              </button>

              {showResult && (
                <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" id="landed-cost-result">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ['Valor CIF', brl(cifBrl)],
                      ['Imposto de Importação (II)', brl(ii)],
                      ['IPI', brl(ipi)],
                      ['PIS-Importação', brl(pis)],
                      ['COFINS-Importação', brl(cofins)],
                      ['ICMS (por dentro)', brl(icms)]
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between rounded-lg bg-white px-3 py-2">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-mono font-semibold text-slate-800">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-white">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">Custo total nacionalizado</span>
                      <span className="font-mono text-base font-semibold">{brl(landedTotal)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">Custo unitário</span>
                      <span className="font-mono text-base font-semibold text-slate-800">{brl(unitCost)}</span>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <span className="block text-[10px] uppercase tracking-wider text-emerald-600">Preço de venda ({inputs.targetMarginPct}%)</span>
                      <span className="font-mono text-base font-semibold text-emerald-700">{brl(suggestedUnitPrice)}</span>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Estimativa preventiva com ICMS calculado "por dentro". Valores de AFRMM, SISCOMEX e despachante não inclusos. Confirme as alíquotas na TEC e na legislação estadual do porto de {inputs.entryPort}.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <span className="text-xs text-slate-400">Passo final</span>
          )}
        </div>

      </div>
    </section>
  );
}
