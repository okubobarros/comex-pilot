/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cotação de Frete Marítimo — comparador sobre a rate sheet desagrupada.
 *
 * A planilha do armador é ilegível para decisão: uma linha esconde N portos de
 * origem, M destinos, 3 equipamentos e tarifas condicionais a peso. Aqui a
 * pergunta é comercial ("Xiamen para Itapoá, 40'HQ, 15 toneladas") e a resposta
 * é uma matriz ordenada por CUSTO TOTAL — frete + taxas — não por tarifa cheia.
 *
 * Backend: /api/freight/* (server/freightService.ts), motor em src/engine/freight.ts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Calculator, Clock, Loader2, Radar, Search, Ship,
  SlidersHorizontal, TriangleAlert, X,
} from 'lucide-react';
import { useEvidence } from '../../context/EvidenceContext';
import FreightRadar, { Corredor } from './FreightRadar';
import type { Cotacao, LinhaCusto } from '../../engine/freight';

interface FreightWorkspaceProps {
  onClose: () => void;
  /** Leva o frete escolhido para o Custeio de Importação. */
  onExportarParaCusteio: (dados: { freteUsd: number; porto: string; rotulo: string }) => void;
}

interface PortoOpt { unlocode: string; name: string }
interface Options {
  pols: PortoOpt[];
  pods: PortoOpt[];
  carriers: string[];
  equipamentos: string[];
  cargas: string[];
  rateSheet: { source_file: string; issued_on: string | null; assumed_year: number };
  totalCotacoes: number;
  fonte: string;
}

const usd = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUS_UI: Record<string, { label: string; dot: string; chip: string }> = {
  vigente:      { label: 'Vigente',       dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  expirando:    { label: 'Expirando',     dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 ring-amber-100' },
  sem_validade: { label: 'Sem validade',  dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  expirado:     { label: 'Expirada',      dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700 ring-rose-100' },
};

const CARGA_LABEL: Record<string, string> = {
  PNEU: 'Pneus', SOLAR: 'Painéis solares', TEXTIL: 'Têxteis / fios', REEFER: 'Refrigerada',
};

/** Free time: "21 / 18 dias". A planilha não diz o que é cada número — ver docs. */
function freeTime(c: Cotacao): string {
  const { free_days_pol: a, free_days_pod: b } = c.quote;
  if (a == null) return '—';
  return b == null ? `${a} dias` : `${a} / ${b} dias`;
}

export default function FreightWorkspace({ onClose, onExportarParaCusteio }: FreightWorkspaceProps) {
  const { setEvidence } = useEvidence();
  const [aba, setAba] = useState<'cotar' | 'radar'>('cotar');
  const [opts, setOpts] = useState<Options | null>(null);
  const [pol, setPol] = useState('');
  const [pod, setPod] = useState('');
  const [equipamento, setEquipamento] = useState('40HQ');
  const [peso, setPeso] = useState('');
  const [pesoBase, setPesoBase] = useState<'CARGO' | 'VGM'>('CARGO');
  const [carga, setCarga] = useState('');
  const [incluirExpiradas, setIncluirExpiradas] = useState(false);
  const [cotacoes, setCotacoes] = useState<Cotacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<Cotacao | null>(null);

  useEffect(() => {
    fetch('/api/freight/options')
      .then((r) => r.json())
      .then(setOpts)
      .catch((e) => setErro(String(e)));
  }, []);

  const buscar = async (over?: { pol: string; pod: string }) => {
    setCarregando(true);
    setErro(null);
    setAberta(null);
    try {
      const p = new URLSearchParams();
      const polAlvo = over?.pol ?? pol;
      const podAlvo = over?.pod ?? pod;
      if (polAlvo) p.set('pol', polAlvo);
      if (podAlvo) p.set('pod', podAlvo);
      if (equipamento) p.set('equipamento', equipamento);
      if (peso.trim()) { p.set('peso', peso.trim()); p.set('pesoBase', pesoBase); }
      if (carga) p.set('carga', carga);
      if (incluirExpiradas) p.set('incluirExpiradas', 'true');
      const r = await fetch(`/api/freight/quotes?${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'falha na consulta');
      setCotacoes(d.cotacoes);
      publicarEvidencia(d.cotacoes);
    } catch (e) {
      setErro((e as Error).message);
      setCotacoes(null);
    } finally {
      setCarregando(false);
    }
  };

  /** Trilha auditável: de onde veio cada número mostrado na matriz. */
  const publicarEvidencia = (cs: Cotacao[]) => {
    if (!opts) return;
    const rota = `${pol || 'todas as origens'} -> ${pod || 'todos os destinos'}`;
    const steps = [
      `Rate sheet "${opts.rateSheet.source_file}" (emissão ${opts.rateSheet.issued_on ?? 'não declarada'}).`,
      `${opts.totalCotacoes} cotações desagrupadas da planilha; filtro aplicado: ${rota}, ${equipamento || 'todos os equipamentos'}.`,
      peso.trim()
        ? `Peso de ${peso} t informado como ${pesoBase === 'VGM' ? 'VGM (com tara)' : 'peso de mercadoria'} — usado para liberar faixas de tarifa e taxas de excesso.`
        : 'Peso não informado: faixas condicionais de tarifa não foram aplicadas.',
      cs.length
        ? `Melhor custo total: ${cs[0].quote.carrier} ${usd(cs[0].totalUsd)} (planilha aba "${cs[0].quote.source_sheet}", linha ${cs[0].quote.source_row}).`
        : 'Nenhuma cotação atende aos filtros.',
    ];
    setEvidence({
      agent: 'costing',
      titulo: `Frete marítimo · ${rota}`,
      steps,
      citations: cs.slice(0, 5).map((c) => ({
        ref: `${c.quote.carrier} ${c.quote.pol}->${c.quote.pod}`,
        nota: `${c.quote.source_sheet}!L${c.quote.source_row} · ${usd(c.totalUsd)}`,
      })),
    });
  };

  /** Vem do Radar: troca para a aba de cotação já com o corredor filtrado. */
  const abrirCorredor = (c: Corredor) => {
    setPol(c.pol);
    setPod(c.pod);
    setAba('cotar');
    buscar({ pol: c.pol, pod: c.pod });
  };

  const podsFiltrados = useMemo(() => opts?.pods ?? [], [opts]);
  const alertasNaBusca = useMemo(
    () => (cotacoes ?? []).reduce((n, c) => n + (c.alertas.length ? 1 : 0), 0),
    [cotacoes],
  );

  return (
    <section className="relative h-full flex-1 overflow-y-auto bg-slate-100/60" id="freight-workspace">
      <div className="mx-auto max-w-5xl px-6 py-6">

        {/* Cabeçalho */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">
                Cotação de Frete Marítimo
              </h2>
              <p className="text-sm text-slate-400">
                {opts
                  ? `${opts.totalCotacoes.toLocaleString('pt-BR')} cotações desagrupadas de ${opts.rateSheet.source_file}`
                  : 'Carregando rate sheet...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} title="Fechar" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {([['cotar', 'Cotar rota', <Search className="h-3.5 w-3.5" key="c" />],
             ['radar', 'Radar de mercado', <Radar className="h-3.5 w-3.5" key="r" />]] as const).map(
            ([id, label, icone]) => (
              <button
                key={id}
                onClick={() => { setAba(id as 'cotar' | 'radar'); setAberta(null); }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                  aba === id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {icone}{label}
              </button>
            ),
          )}
        </div>

        {aba === 'radar' ? (
          <FreightRadar onAbrirCorredor={abrirCorredor} />
        ) : (
          <>
        {/* Filtros */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Origem (POL)</span>
              <select value={pol} onChange={(e) => setPol(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-sky-500">
                <option value="">Todas as origens</option>
                {opts?.pols.map((p) => <option key={p.unlocode} value={p.unlocode}>{p.name} · {p.unlocode}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Destino (POD)</span>
              <select value={pod} onChange={(e) => setPod(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-sky-500">
                <option value="">Todos os destinos</option>
                {podsFiltrados.map((p) => <option key={p.unlocode} value={p.unlocode}>{p.name} · {p.unlocode}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Equipamento</span>
              <select value={equipamento} onChange={(e) => setEquipamento(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-sky-500">
                <option value="">Todos</option>
                <option value="20GP">20&apos; GP</option>
                <option value="40GP">40&apos; GP</option>
                <option value="40HQ">40&apos; HQ</option>
                <option value="40NOR">40&apos; NOR</option>
                <option value="40RF">40&apos; Reefer</option>
                <option value="LCL">LCL (m³)</option>
              </select>
            </label>
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Peso da carga (t)
              </span>
              <div className="flex gap-1">
                <input
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscar()}
                  placeholder="ex: 15"
                  inputMode="decimal"
                  className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-700 outline-none focus:border-sky-500"
                />
                {/* VGM inclui a tara do contêiner. Sem esse controle, a faixa de
                    peso é aplicada sobre a base errada e o desconto é glosado. */}
                <select
                  value={pesoBase}
                  onChange={(e) => setPesoBase(e.target.value as 'CARGO' | 'VGM')}
                  title="A tarifa condicional pode ser medida em peso de mercadoria ou em VGM (que inclui a tara do contêiner)"
                  className="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-1.5 py-2 text-xs text-slate-600 outline-none focus:border-sky-500"
                >
                  <option value="CARGO">carga</option>
                  <option value="VGM">VGM</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-300" />
            <select value={carga} onChange={(e) => setCarga(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-sky-500">
              <option value="">Carga geral</option>
              {opts?.cargas.map((c) => <option key={c} value={c}>{CARGA_LABEL[c] ?? c}</option>)}
            </select>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={incluirExpiradas} onChange={(e) => setIncluirExpiradas(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600" />
              Incluir tarifas expiradas
            </label>
            <button
              onClick={buscar}
              disabled={carregando}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
            >
              {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Cotar
            </button>
          </div>
        </div>

        {erro && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
          </div>
        )}

        {/* Matriz comparativa */}
        {cotacoes && (
          <>
            <div className="mb-2 flex items-end justify-between">
              <p className="text-xs text-slate-400">
                {cotacoes.length === 0
                  ? 'Nenhuma tarifa atende aos filtros.'
                  : `${cotacoes.length} ${cotacoes.length === 1 ? 'opção' : 'opções'} · ordenadas por custo total`}
                {alertasNaBusca > 0 && ` · ${alertasNaBusca} com ressalva`}
              </p>
              {cotacoes.length > 0 && (
                <p className="text-[10px] text-slate-300">clique numa linha para ver a composição</p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2 font-semibold">Armador</th>
                      <th className="px-3 py-2 font-semibold">Rota</th>
                      <th className="px-3 py-2 font-semibold">Equip.</th>
                      <th className="px-3 py-2 text-right font-semibold">Frete</th>
                      <th className="px-3 py-2 text-right font-semibold">Taxas</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="px-3 py-2 font-semibold">Free time</th>
                      <th className="px-3 py-2 font-semibold">Validade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotacoes.map((c, i) => {
                      const st = STATUS_UI[c.status] ?? STATUS_UI.sem_validade;
                      const taxas = c.totalUsd - c.tarifaAplicada;
                      const melhor = i === 0 && c.status !== 'expirado';
                      return (
                        <tr
                          key={c.quote.quote_id}
                          onClick={() => setAberta(c)}
                          className={`cursor-pointer border-b border-slate-100 transition-colors duration-150 last:border-0 hover:bg-sky-50/60 ${
                            aberta?.quote.quote_id === c.quote.quote_id ? 'bg-sky-50' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">{c.quote.carrier}</span>
                              {melhor && (
                                <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                  melhor
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{c.quote.service_type}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              {c.quote.pol_name} <ArrowRight className="h-3 w-3 text-slate-300" /> {c.quote.pod_name}
                            </div>
                            <span className="font-mono text-[10px] text-slate-300">
                              {c.quote.pol} · {c.quote.pod}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                              {c.quote.equipment_type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-medium text-slate-700">{usd(c.tarifaAplicada)}</span>
                            {c.descontoPeso > 0 && (
                              <span className="block text-[10px] font-medium text-emerald-600">
                                −{usd(c.descontoPeso)} por peso
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-slate-500">
                            {taxas > 0 ? `+ ${usd(taxas)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-semibold tabular-nums text-slate-900">{usd(c.totalUsd)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{freeTime(c)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${st.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                            {c.quote.validity_end && (
                              <span className="mt-0.5 block font-mono text-[10px] text-slate-300">
                                até {c.quote.validity_end.slice(5).replace('-', '/')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!cotacoes && !erro && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 py-14 text-center">
            <Ship className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-500">Escolha origem, destino e equipamento</p>
            <p className="mt-1 text-xs text-slate-400">
              Informe o peso para que as tarifas condicionais e as taxas de excesso entrem no total.
            </p>
          </div>
        )}
        </>
        )}
      </div>

      {/* Painel lateral — composição do custo */}
      {aberta && (
        <DetalheRota
          c={aberta}
          onClose={() => setAberta(null)}
          onExportar={() =>
            onExportarParaCusteio({
              freteUsd: aberta.totalUsd,
              porto: aberta.quote.pod_name,
              rotulo: `${aberta.quote.carrier} ${aberta.quote.pol_name} → ${aberta.quote.pod_name} (${aberta.quote.equipment_type})`,
            })
          }
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function DetalheRota({ c, onClose, onExportar }: { c: Cotacao; onClose: () => void; onExportar: () => void }) {
  const q = c.quote;
  const st = STATUS_UI[c.status] ?? STATUS_UI.sem_validade;
  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold text-slate-900">{q.carrier}</span>
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${st.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {q.pol_name} → {q.pod_name} · {q.equipment_type} · {q.service_name || q.service_type}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* Composição */}
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Composição do frete</p>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {c.linhas.map((l: LinhaCusto, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
              <div className="min-w-0">
                <span className="block truncate text-xs text-slate-600">{l.rotulo}</span>
                {l.detalhe && <span className="block text-[10px] text-slate-400">{l.detalhe}</span>}
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-slate-700">{usd(l.valorUsd)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between bg-slate-50 px-3 py-2.5">
            <span className="text-xs font-semibold text-slate-700">Total do frete internacional</span>
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900">{usd(c.totalUsd)}</span>
          </div>
        </div>

        {/* Ressalvas */}
        {c.alertas.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              <AlertTriangle className="h-3 w-3" /> Antes de fechar
            </p>
            <ul className="space-y-1">
              {c.alertas.map((a, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-amber-900">• {a}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Operacional */}
        <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Regras operacionais</p>
        <dl className="space-y-1.5 text-xs">
          <Linha rotulo="Free time" valor={freeTime(c)} icone={<Clock className="h-3 w-3" />} />
          <Linha rotulo="Serviço" valor={q.service_name || q.service_type} />
          <Linha rotulo="Validade" valor={q.validity_raw || '—'} />
          {q.vessel_ref && <Linha rotulo="Navio / viagem" valor={q.vessel_ref} />}
          {q.space_status && <Linha rotulo="Espaço" valor={q.space_status} />}
          {q.cargo_type && <Linha rotulo="Restrita a" valor={CARGA_LABEL[q.cargo_type] ?? q.cargo_type} />}
          <Linha rotulo="Fonte" valor={`${q.source_sheet} · linha ${q.source_row}`} />
        </dl>
      </div>

      <footer className="border-t border-slate-200 p-3">
        <button
          onClick={onExportar}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-700"
        >
          <Calculator className="h-4 w-4" />
          Exportar para Custeio de Importação
        </button>
        <p className="mt-1.5 text-center text-[10px] leading-relaxed text-slate-400">
          Leva {usd(c.totalUsd)} para o campo de frete e recalcula II, IPI, PIS/COFINS e ICMS.
        </p>
      </footer>
    </aside>
  );
}

function Linha({ rotulo, valor, icone }: { rotulo: string; valor: string; icone?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex shrink-0 items-center gap-1 text-slate-400">{icone}{rotulo}</dt>
      <dd className="min-w-0 break-words text-right text-slate-600">{valor}</dd>
    </div>
  );
}
