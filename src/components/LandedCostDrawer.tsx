/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Skill densa "Custeio e Viabilidade (Landed Cost)": formulário assistido por IA
 * em 3 passos que roda no canvas da direita. Aceita colar/arrastar dados brutos
 * de uma Invoice no topo para pré-preencher os campos estruturados.
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, Check, FileDown, GitCompare, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import { LandedCostInputs } from '../types';
import { buildHeuristicAnalysis, findRuleForNcm } from '../engine/rulesEngine';
import { DEFAULT_NCM_RULES } from '../data/ncmRules';
import { computeCosting } from '../engine/costing';
import type { CostingResult, CostingRates } from '../engine/costing';
import { resolveRatesLocal } from '../engine/offline';
import { useEvidence } from '../context/EvidenceContext';
import CostingCanvas from './costing/CostingCanvas';

interface LandedCostDrawerProps {
  onClose: () => void;
  /**
   * Frete trazido da Cotação de Frete Marítimo (ver freight/FreightWorkspace).
   *
   * `freteUsd` já é o custo TOTAL — internacional mais taxas locais de destino.
   * A composição vem junto para que o custeio possa DIZER de onde saiu o
   * número: um valor de frete sem origem é o primeiro campo que alguém
   * contesta na reunião, e sem isso não há como responder.
   */
  seedFrete?: {
    freteUsd: number;
    porto: string;
    rotulo: string;
    freteInternacionalUsd?: number;
    taxasLocaisUsd?: number;
    containers?: number;
    usdBrl?: number;
  } | null;
}

/**
 * Portos de entrada. A UF entre parênteses é o que determina a alíquota de
 * ICMS, então a lista precisa cobrir todos os destinos da rate sheet — sem
 * Itapoá ou Navegantes, um frete cotado para SC seria custeado como SP.
 */
const PORTOS_ENTRADA = [
  'Santos (SP)', 'Paranaguá (PR)', 'Itajaí (SC)', 'Itapoá (SC)', 'Navegantes (SC)',
  'Rio de Janeiro (RJ)', 'Rio Grande (RS)', 'Vitória (ES)', 'Salvador (BA)',
  'Suape (PE)', 'Pecém (CE)', 'Manaus (AM)', 'Vila do Conde (PA)', 'Viracopos (SP)',
];

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
  outrasDespesasBrl: 0,
  iiRate: 16,
  ipiRate: 10,
  icmsRate: 18,
  usdBrl: 5.5,
  targetMarginPct: 40
};

const STEPS = ['Produto e Origem', 'Rota Tributária e Portos', 'Margem e Target'];

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function LandedCostDrawer({ onClose, seedFrete }: LandedCostDrawerProps) {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<LandedCostInputs>(DEFAULTS);
  const [rawData, setRawData] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [engine, setEngine] = useState<CostingResult | null>(null);
  const [engineRates, setEngineRates] = useState<CostingRates | null>(null);
  const [engineErr, setEngineErr] = useState<string | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [ptaxDate, setPtaxDate] = useState<string | null>(null);
  const [ptaxLoading, setPtaxLoading] = useState(false);
  /**
   * Cenário B: o mesmo embarque desembaraçado por OUTRO porto.
   *
   * É a comparação que mais move dinheiro no custeio, porque o ICMS é estadual:
   * a mesma carga entrando por Santos (SP) ou por Itapoá (SC) muda a alíquota e,
   * com ela, o custo final. O formulário sequencial escondia isso.
   */
  const [portoB, setPortoB] = useState<string | null>(null);
  const [engineB, setEngineB] = useState<CostingResult | null>(null);
  const [ratesB, setRatesB] = useState<CostingRates | null>(null);
  // Data do fato gerador = hoje. A lógica versionada (IBS/CBS por vigência)
  // continua no motor/backend; apenas não é mais selecionável na interface.
  const dataFatoGerador = new Date().toISOString().slice(0, 10);
  const { setEvidence } = useEvidence();

  // Busca a PTAX do dia na API do BCB e preenche o câmbio automaticamente.
  const fetchPtax = async () => {
    setPtaxLoading(true);
    try {
      const resp = await fetch('/api/ptax');
      const data = resp.ok ? await resp.json() : { success: false };
      if (data.success) {
        setInputs((prev) => ({ ...prev, usdBrl: data.usdBrl }));
        setPtaxDate(data.date);
        return;
      }
      // Fallback (produção estática): chama a PTAX do BCB direto do navegador.
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const mmddyyyy = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
        try {
          const r = await fetch(`https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@d)?@d='${mmddyyyy}'&$format=json`);
          const j = await r.json();
          const v = j?.value?.[0]?.cotacaoVenda;
          if (v) { setInputs((prev) => ({ ...prev, usdBrl: v })); setPtaxDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); return; }
        } catch { /* tenta o dia anterior */ }
      }
    } catch {
      /* mantém o valor manual */
    } finally {
      setPtaxLoading(false);
    }
  };

  // Puxa a PTAX ao abrir a skill (efeito de "dado ao vivo").
  useEffect(() => { fetchPtax(); }, []);

  // Deriva a UF a partir do porto de entrada (ex.: "Santos (SP)" → "SP").
  const ufFromPort = (p: string) => p.match(/\(([A-Z]{2})\)/)?.[1] ?? 'SP';

  /**
   * Frete vindo da cotação marítima: preenche o campo e alinha o porto de
   * entrada ao POD cotado — o ICMS depende da UF, então importar o valor sem o
   * porto produziria um custo errado em silêncio.
   */
  useEffect(() => {
    if (!seedFrete) return;
    setInputs((prev) => {
      const porto = PORTOS_ENTRADA.find((p) => p.toLowerCase().startsWith(seedFrete.porto.toLowerCase()));
      // O frete INTERNACIONAL vai para o campo de frete: é ele que compõe o
      // valor aduaneiro. As taxas locais de destino vão para despesas
      // aduaneiras, em BRL — elas entram na base do ICMS mas NÃO no VMLD.
      // Somar tudo no frete faria o importador pagar II, IPI, PIS, COFINS e
      // AFRMM sobre um valor que a legislação não manda incluir.
      const internacional = seedFrete.freteInternacionalUsd ?? seedFrete.freteUsd;
      const cambio = seedFrete.usdBrl && seedFrete.usdBrl > 0 ? seedFrete.usdBrl : prev.usdBrl;
      const locaisBrl = Math.round((seedFrete.taxasLocaisUsd ?? 0) * cambio * 100) / 100;
      return {
        ...prev,
        freightUsd: internacional,
        outrasDespesasBrl: locaisBrl || prev.outrasDespesasBrl,
        usdBrl: seedFrete.usdBrl && seedFrete.usdBrl > 0 ? seedFrete.usdBrl : prev.usdBrl,
        entryPort: porto ?? prev.entryPort,
      };
    });
    setAiFilled((prev) => {
      const s = new Set(prev).add('freightUsd');
      if ((seedFrete.taxasLocaisUsd ?? 0) > 0) s.add('outrasDespesasBrl');
      return s;
    });
    const money = (v: number) => `USD ${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
    // A composição só aparece quando as taxas locais realmente entraram. Sem
    // PTAX elas vêm zeradas, e afirmar "inclui taxas locais" seria falso.
    const temLocais = (seedFrete.taxasLocaisUsd ?? 0) > 0;
    const cambioNota = seedFrete.usdBrl && seedFrete.usdBrl > 0 ? seedFrete.usdBrl : null;
    setPrefillNote(
      temLocais
        ? `Cotação importada: ${seedFrete.rotulo}. `
          + `${money(seedFrete.freteInternacionalUsd ?? 0)} de frete internacional (compõe o valor aduaneiro) `
          + `e ${money(seedFrete.taxasLocaisUsd ?? 0)} de taxas locais no destino, lançadas como despesas `
          + `aduaneiras — elas entram na base do ICMS, não no VMLD`
          + `${cambioNota ? `. PTAX ${cambioNota.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}` : ''}.`
        : `Frete de ${money(seedFrete.freteUsd)} importado da cotação: ${seedFrete.rotulo}. `
          + 'Só o frete internacional — as taxas locais do destino ainda precisam ser somadas.',
    );
  }, [seedFrete]);

  // Aplica um resultado de custeio (do backend ou do fallback local) na UI + trilha.
  const applyCosting = (result: CostingResult, r: CostingRates, origem: string) => {
    setEngine(result);
    setEngineRates(r);
    setEvidence({
      agent: 'costing',
      titulo: `Custeio · NCM ${inputs.ncm || '—'}`,
      steps: [
        `Resolvi as alíquotas do NCM (${origem}): II ${r.iiPct}% · IPI ${r.ipiPct}% · PIS ${r.pisPct}% · COFINS ${r.cofinsPct}%.`,
        `ICMS ${r.icmsPct}% (UF de ${inputs.entryPort}) calculado "por dentro"; AFRMM ${r.afrmmPct}% e Taxa Siscomex aplicados.`,
        `Regra IBS/CBS vigente: CBS ${r.reforma.cbsPct}% + IBS ${r.reforma.ibsPct}% ${r.reforma.cbsCompensavel ? '(compensáveis)' : '(impacto de caixa)'}.`,
      ],
      citations: [{ ref: 'LC 214/2025', nota: r.reforma.baseLegal }, { ref: 'Decreto 12.955/2026', nota: 'Base de cálculo do CBS/IBS (art. 13).' }],
    });
  };

  // Fallback client-side (produção estática sem backend): mesmos dados reais embutidos.
  const computeLocal = () => {
    const r = resolveRatesLocal(inputs.ncm, ufFromPort(inputs.entryPort), dataFatoGerador);
    const result = computeCosting(
      { fobUsd: inputs.fobUsd, freightUsd: inputs.freightUsd, insuranceUsd: inputs.insuranceUsd, usdBrl: inputs.usdBrl, outrasDespesasBrl: inputs.outrasDespesasBrl },
      r,
    );
    applyCosting(result, r, 'base local');
  };

  /** Roda o motor para um porto qualquer, sem tocar no estado do cenário A. */
  const calcularPara = async (porto: string): Promise<{ r: CostingResult; rates: CostingRates }> => {
    const corpo = {
      ncm: inputs.ncm, uf: ufFromPort(porto), modal: 'longo_curso',
      qtdeAdicoes: 1, fobUsd: inputs.fobUsd, freightUsd: inputs.freightUsd,
      insuranceUsd: inputs.insuranceUsd, usdBrl: inputs.usdBrl,
      outrasDespesasBrl: inputs.outrasDespesasBrl, dataFatoGerador,
    };
    try {
      const resp = await fetch('/api/costing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
      });
      const data = resp.ok ? await resp.json() : { success: false };
      if (data.success) return { r: data.result, rates: data.rates };
    } catch { /* cai no motor local */ }
    const rates = resolveRatesLocal(inputs.ncm, ufFromPort(porto), dataFatoGerador);
    return {
      r: computeCosting(
        { fobUsd: inputs.fobUsd, freightUsd: inputs.freightUsd, insuranceUsd: inputs.insuranceUsd, usdBrl: inputs.usdBrl, outrasDespesasBrl: inputs.outrasDespesasBrl },
        rates,
      ),
      rates,
    };
  };

  const compararCom = async (porto: string) => {
    setPortoB(porto);
    if (!porto) { setEngineB(null); setRatesB(null); return; }
    const { r, rates } = await calcularPara(porto);
    setEngineB(r); setRatesB(rates);
  };

  // Consulta o motor real (alíquotas do banco); se indisponível, calcula localmente.
  const calcular = async () => {
    setShowResult(true);
    setEngine(null); setEngineErr(null); setEngineLoading(true);
    try {
      const resp = await fetch('/api/costing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ncm: inputs.ncm, uf: ufFromPort(inputs.entryPort), modal: 'longo_curso',
          qtdeAdicoes: 1, fobUsd: inputs.fobUsd, freightUsd: inputs.freightUsd,
          insuranceUsd: inputs.insuranceUsd, usdBrl: inputs.usdBrl,
          outrasDespesasBrl: inputs.outrasDespesasBrl, dataFatoGerador,
        }),
      });
      const data = resp.ok ? await resp.json() : { success: false };
      if (data.success) applyCosting(data.result, data.rates, 'banco');
      else computeLocal();
    } catch {
      computeLocal();
    } finally {
      setEngineLoading(false);
    }
    if (portoB) void compararCom(portoB);
  };


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
    setAiFilled(new Set(['productDescription', 'ncm', 'origin', 'fobUsd', 'quantity', 'iiRate']));
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              disabled={!engine}
              title={engine
                ? 'Abre a caixa de impressão do navegador — escolha "Salvar como PDF"'
                : 'Calcule o custeio antes de exportar'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors duration-150 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileDown className="h-3.5 w-3.5" /> Exportar dossiê em PDF
            </button>
            <button onClick={onClose} title="Fechar skill" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Cabeçalho que só existe no PDF — dá identidade e rastreabilidade ao
            documento que sai da impressão. */}
        <div className="hidden print:mb-4 print:block print:border-b print:border-slate-300 print:pb-3">
          <p className="text-lg font-bold tracking-tight">ComexPilot · Dossiê de Custeio de Importação</p>
          <p className="mt-0.5 text-xs">
            NCM {inputs.ncm || '—'} · {inputs.productDescription || 'mercadoria não descrita'} ·
            origem {inputs.origin} · entrada por {inputs.entryPort}
          </p>
          <p className="text-xs">
            Emitido em {new Date().toLocaleString('pt-BR')} · câmbio USD/BRL {inputs.usdBrl} ·
            fato gerador {dataFatoGerador}
          </p>
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

        {/* Canvas de custeio (dados brutos · sugestão IA · reconciliação) */}
        {prefillNote && (
          <CostingCanvas
            rawText={rawData}
            inputs={inputs}
            rates={engineRates}
            aiFilled={aiFilled}
            onAcceptFreight={(usd) => set('freightUsd', usd)}
          />
        )}

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
                  {PORTOS_ENTRADA.map((p) => <option key={p}>{p}</option>)}
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
              {/* Despesas de destino ficam FORA do valor aduaneiro e DENTRO da
                  base do ICMS. Por isso campo próprio, em BRL, e não somadas
                  ao frete: no frete elas puxariam II, IPI, PIS, COFINS e AFRMM
                  para cima sobre um valor que não compõe o CIF. */}
              <div>
                <label className={labelClass}>Despesas aduaneiras (BRL)</label>
                <input
                  type="number"
                  className={`${inputClass} font-mono`}
                  value={inputs.outrasDespesasBrl || ''}
                  onChange={num('outrasDespesasBrl')}
                  title="THC/capatazia, ISPS, drop off, BL fee e honorários no destino. Entram na base do ICMS, não no valor aduaneiro."
                />
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
                <div className="mb-1 flex items-center justify-between">
                  <label className={`${labelClass} mb-0`}>Câmbio USD → BRL</label>
                  <button
                    type="button"
                    onClick={fetchPtax}
                    disabled={ptaxLoading}
                    title="Buscar PTAX do dia no Banco Central"
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${ptaxLoading ? 'animate-spin' : ''}`} />
                    PTAX
                  </button>
                </div>
                <input type="number" className={`${inputClass} font-mono`} value={inputs.usdBrl || ''} onChange={num('usdBrl')} />
                {ptaxDate && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    PTAX ao vivo · BCB · {new Date(ptaxDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
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
                onClick={calcular}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                <Calculator className="h-4 w-4" />
                Calcular Landed Cost
              </button>

              {/* Cenário B — o mesmo embarque por outro porto de entrada */}
              <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <GitCompare className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-700">Comparar com outro porto de entrada</span>
                  <select
                    value={portoB ?? ''}
                    onChange={(e) => void compararCom(e.target.value)}
                    className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">Sem comparação</option>
                    {PORTOS_ENTRADA.filter((p) => p !== inputs.entryPort).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  O ICMS é estadual: a mesma carga entrando por UFs diferentes tem custo final
                  diferente. Escolha um porto para ver o impacto lado a lado.
                </p>

                {engineB && engine && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                    <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <span className="px-3 py-2">Tributo</span>
                      <span className="px-3 py-2 text-right">A · {inputs.entryPort}</span>
                      <span className="px-3 py-2 text-right">B · {portoB}</span>
                    </div>
                    {([
                      ['II', engine.ii, engineB.ii],
                      ['IPI', engine.ipi, engineB.ipi],
                      ['PIS', engine.pis, engineB.pis],
                      ['COFINS', engine.cofins, engineB.cofins],
                      [`ICMS (${engineRates?.icmsPct ?? '—'}% × ${ratesB?.icmsPct ?? '—'}%)`, engine.icms, engineB.icms],
                    ] as [string, number, number][]).map(([k, a, b]) => (
                      <div key={k} className="grid grid-cols-3 border-b border-slate-100 text-xs last:border-0">
                        <span className="px-3 py-1.5 text-slate-500">{k}</span>
                        <span className="px-3 py-1.5 text-right font-mono text-slate-700">{brl(a)}</span>
                        <span className={`px-3 py-1.5 text-right font-mono ${
                          b < a ? 'text-emerald-600' : b > a ? 'text-rose-600' : 'text-slate-700'
                        }`}>{brl(b)}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-3 bg-slate-900 text-white">
                      <span className="px-3 py-2.5 text-[11px] font-semibold">Custo total</span>
                      <span className="px-3 py-2.5 text-right font-mono text-sm font-semibold">{brl(engine.ctiAsIs)}</span>
                      <span className="px-3 py-2.5 text-right font-mono text-sm font-semibold">{brl(engineB.ctiAsIs)}</span>
                    </div>
                    <div className={`px-3 py-2 text-xs font-semibold ${
                      engineB.ctiAsIs < engine.ctiAsIs
                        ? 'bg-emerald-50 text-emerald-800'
                        : engineB.ctiAsIs > engine.ctiAsIs ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-600'
                    }`}>
                      {engineB.ctiAsIs === engine.ctiAsIs
                        ? 'Custo idêntico nos dois portos.'
                        : engineB.ctiAsIs < engine.ctiAsIs
                          ? `Entrar por ${portoB} economiza ${brl(engine.ctiAsIs - engineB.ctiAsIs)} neste embarque.`
                          : `Entrar por ${portoB} custa ${brl(engineB.ctiAsIs - engine.ctiAsIs)} a mais neste embarque.`}
                      <span className="ml-1 font-normal text-slate-500">
                        Compara só a carga tributária — frete interno e armazenagem no destino não entram.
                      </span>
                    </div>
                  </div>
                )}
              </div>

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
                    Estimativa local com ICMS "por dentro". O bloco abaixo usa o <strong>motor de custeio com alíquotas reais</strong> do banco (NCM/UF/data) e inclui AFRMM, Siscomex e a Reforma (IBS/CBS).
                  </p>

                  {/* Motor de custeio real (alíquotas do schema mcat) */}
                  {engineLoading && (
                    <div className="rounded-lg bg-white px-3 py-2 text-[11px] text-slate-500">Consultando alíquotas reais…</div>
                  )}
                  {engineErr && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Motor real indisponível: {engineErr} — mostrando apenas a estimativa local acima.
                    </div>
                  )}
                  {engine && (
                    <div className="space-y-2.5 rounded-xl border border-indigo-200 bg-white p-3" id="engine-result">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                          <Sparkles className="h-3.5 w-3.5" /> Motor de custeio · alíquotas reais (mcat)
                        </span>
                        {engineRates && (
                          <span className="font-mono text-[10px] text-slate-400">
                            II {engineRates.iiPct}% · IPI {engineRates.ipiPct}% · PIS {engineRates.pisPct}% · COFINS {engineRates.cofinsPct}% · ICMS {engineRates.icmsPct}% · AFRMM {engineRates.afrmmPct}%
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        {[
                          ['II', brl(engine.ii)], ['IPI', brl(engine.ipi)], ['PIS', brl(engine.pis)], ['COFINS', brl(engine.cofins)],
                          ['AFRMM', brl(engine.afrmm)], ['Siscomex', brl(engine.siscomex)], ['ICMS', brl(engine.icms)], ['VMLD', brl(engine.vmld)],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                            <span className="text-slate-500">{k}</span>
                            <span className="font-mono text-xs font-semibold text-slate-800">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-2.5 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-white">
                          <span className="block text-[10px] uppercase tracking-wider text-slate-400">CTI (desembolso as-is)</span>
                          <span className="font-mono text-base font-semibold">{brl(engine.ctiAsIs)}</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <span className="block text-[10px] uppercase tracking-wider text-slate-400">IBS/CBS a declarar</span>
                          <span className="font-mono text-base font-semibold text-slate-800">{brl(engine.cbsDeclarar + engine.ibsDeclarar)}</span>
                          <span className="ml-1 font-mono text-[10px] text-slate-400">CBS {brl(engine.cbsDeclarar)} · IBS {brl(engine.ibsDeclarar)}</span>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                          <span className="block text-[10px] uppercase tracking-wider text-emerald-600">Impacto de caixa CBS/IBS</span>
                          <span className="font-mono text-base font-semibold text-emerald-700">{brl(engine.impactoCaixaNovos)}</span>
                          {engine.impactoCaixaNovos === 0 && (
                            <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700">compensável</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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
