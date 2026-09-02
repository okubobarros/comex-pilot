/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cotação de Frete Marítimo — dashboard executivo em split view.
 *
 * A planilha do armador é ilegível para decisão: uma linha esconde N portos de
 * origem, M destinos, 3 equipamentos e tarifas condicionais a peso. Aqui a
 * pergunta é comercial ("Xiamen para Itapoá, 40'HQ, 15 toneladas") e a resposta
 * é uma lista ranqueada por CUSTO TOTAL — frete + taxas — com o detalhamento
 * fixo à direita.
 *
 * DUAS RESSALVAS SOBRE OS DADOS, que moldaram decisões desta tela:
 *
 *  1. A rate sheet NÃO declara tempo de trânsito. A aba "Mais rápidas" ordena
 *     por serviço direto × transbordo, que é o único sinal de velocidade que a
 *     planilha oferece — nenhum número de dias é estimado.
 *  2. Não há integração com armador. O botão de booking monta uma SOLICITAÇÃO
 *     para o usuário enviar; não reserva praça.
 *
 * Backend: /api/freight/* (server/freightService.ts), motor em src/engine/freight.ts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, ArrowRightLeft, Bookmark, Calculator, Check, Clock,
  FileText, Loader2, Map as MapIcon, Printer, Search, Send, Ship, Timer,
  TrendingDown, Trophy, X, Zap,
} from 'lucide-react';
import { useEvidence } from '../../context/EvidenceContext';
import FreightRadar, { Corredor } from './FreightRadar';
import FreightMap, { ArcoRota } from './FreightMap';
import { estimarTransito, temTarifaSuspeita } from '../../engine/freight';
import type { Cotacao, LinhaCusto } from '../../engine/freight';
import { porEntidade } from '../../engine/localCharges';
import type { CustoLocal } from '../../engine/localCharges';

interface FreightWorkspaceProps {
  onClose: () => void;
  /**
   * Leva o frete escolhido para o Custeio de Importação.
   *
   * `freteUsd` é o custo TOTAL (internacional + taxas locais de destino), que é
   * o número que entra na base de cálculo. `freteInternacionalUsd` e
   * `taxasLocaisUsd` vão junto para o custeio poder mostrar de onde veio — um
   * total sem composição é um número que ninguém consegue defender.
   */
  onExportarParaCusteio: (dados: {
    freteUsd: number;
    porto: string;
    rotulo: string;
    freteInternacionalUsd?: number;
    taxasLocaisUsd?: number;
    containers?: number;
    usdBrl?: number;
  }) => void;
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

type Vista = 'mapa' | 'lista';
type Aba = 'recomendadas' | 'rapidas' | 'baratas';

const usd = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUS_UI: Record<string, { label: string; dot: string; chip: string }> = {
  vigente:      { label: 'Vigente',      dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  expirando:    { label: 'Expirando',    dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 ring-amber-100' },
  sem_validade: { label: 'Sem validade', dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  expirado:     { label: 'Expirada',     dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700 ring-rose-100' },
};

const CARGA_LABEL: Record<string, string> = {
  PNEU: 'Pneus', SOLAR: 'Painéis solares', TEXTIL: 'Têxteis / fios', REEFER: 'Refrigerada',
};

const ABAS: { id: Aba; label: string; icone: React.ReactNode; nota: string }[] = [
  { id: 'recomendadas', label: 'Recomendadas', icone: <Trophy className="h-3.5 w-3.5" />,
    nota: 'Vigência primeiro, depois custo total.' },
  { id: 'rapidas', label: 'Mais rápidas', icone: <Zap className="h-3.5 w-3.5" />,
    nota: 'Trânsito ESTIMADO por distância real entre os portos — a rate sheet não o declara.' },
  { id: 'baratas', label: 'Mais baratas', icone: <TrendingDown className="h-3.5 w-3.5" />,
    nota: 'Só o custo total, inclusive tarifas prestes a vencer.' },
];

/** Identifica a ROTA (par de portos) de uma cotação — o arco do mapa. */
const chaveArco = (c: Cotacao) => `${c.quote.pol}|${c.quote.pod}`;

/** Free time: "21 / 18 dias". A planilha não diz o que é cada número — ver docs. */
function freeTime(c: Cotacao): string {
  const { free_days_pol: a, free_days_pod: b } = c.quote;
  if (a == null) return '—';
  return b == null ? `${a} dias` : `${a} / ${b} dias`;
}

/** Iniciais do armador — a rate sheet não traz logotipo. */
function BadgeArmador({ code, destaque }: { code: string; destaque?: boolean }) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xs font-bold tracking-tight ${
        destaque ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200/80 bg-slate-50 text-slate-600'
      }`}
      title={code}
    >
      {code.slice(0, 4)}
    </div>
  );
}

export default function FreightWorkspace({ onClose, onExportarParaCusteio }: FreightWorkspaceProps) {
  const { setEvidence } = useEvidence();
  // Mapa é a visão padrão: o corredor inteiro cabe numa olhada.
  const [vista, setVista] = useState<Vista>('mapa');
  const [aba, setAba] = useState<Aba>('recomendadas');

  const [opts, setOpts] = useState<Options | null>(null);
  const [pol, setPol] = useState('');
  const [pod, setPod] = useState('');
  const [equipamento, setEquipamento] = useState('40HQ');
  const [peso, setPeso] = useState('');
  const [pesoBase, setPesoBase] = useState<'CARGO' | 'VGM'>('CARGO');
  const [carga, setCarga] = useState('');
  const [servico, setServico] = useState('');
  const [somenteVigentes, setSomenteVigentes] = useState(true);

  const [cotacoes, setCotacoes] = useState<Cotacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<Cotacao | null>(null);
  const [booking, setBooking] = useState<Cotacao | null>(null);
  const [buscaSalva, setBuscaSalva] = useState(false);
  /**
   * Quantidade de conteineres. Governa o custo local: taxa por BL e cobrada
   * uma vez, taxa por CNTR multiplica. Sem esse numero nao da para somar as
   * taxas de destino, so o frete internacional.
   */
  const [containers, setContainers] = useState('1');
  /** PTAX do dia, para trazer as taxas em BRL para a mesma moeda do frete. */
  const [ptax, setPtax] = useState<{ usdBrl: number; date: string } | null>(null);
  const [custoLocal, setCustoLocal] = useState<CustoLocal | null>(null);
  const [semTaxaLocal, setSemTaxaLocal] = useState<string | null>(null);
  /** Rede completa de corredores — desenha o mapa antes da primeira busca. */
  const [rede, setRede] = useState<Corredor[]>([]);

  useEffect(() => {
    fetch('/api/freight/options')
      .then((r) => r.json())
      .then((o: Options) => {
        setOpts(o);
        // Retoma a última busca salva pelo próprio usuário nesta máquina.
        try {
          const s = localStorage.getItem('comexpilot.frete.busca');
          if (!s) return;
          const b = JSON.parse(s);
          setPol(b.pol ?? ''); setPod(b.pod ?? '');
          setEquipamento(b.equipamento ?? '40HQ');
          setPeso(b.peso ?? ''); setPesoBase(b.pesoBase ?? 'CARGO');
          setCarga(b.carga ?? ''); setServico(b.servico ?? '');
          setBuscaSalva(true);
        } catch { /* storage indisponível: segue sem retomar */ }
      })
      .catch((e) => setErro(String(e)));

    // Câmbio do dia. As taxas locais vêm em BRL e USD; sem uma taxa REAL não
    // há como somá-las ao frete. Se a PTAX não responder, o custo local
    // aparece separado por moeda em vez de convertido por um número chutado.
    fetch('/api/ptax')
      .then((r) => r.json())
      .then((d) => { if (d?.success && d.usdBrl > 0) setPtax({ usdBrl: d.usdBrl, date: d.date }); })
      .catch(() => { /* segue sem conversão */ });

    // O canvas nunca abre vazio: sem busca ainda, mostra a rede inteira.
    fetch('/api/freight/radar?equipamento=40HQ')
      .then((r) => r.json())
      .then((d) => setRede(d.corredores ?? []))
      .catch(() => { /* mapa fica só com os continentes */ });
  }, []);

  /**
   * Taxas locais da cotação em foco.
   *
   * Refaz a cada troca de cotação, de quantidade ou de câmbio — as três mudam
   * o resultado. O 404 é informação, não erro: a base cobre 12 portos
   * brasileiros, e um destino fora dela precisa aparecer como "não temos",
   * nunca como custo local zero.
   */
  useEffect(() => {
    const q = selecionada?.quote;
    if (!q) { setCustoLocal(null); setSemTaxaLocal(null); return; }
    let cancelado = false;
    const p = new URLSearchParams({
      pod: q.pod,
      carrier: q.carrier,
      containers: String(Math.max(1, Number(containers) || 1)),
      usdBrl: String(ptax?.usdBrl ?? 0),
    });
    fetch(`/api/freight/local-charges?${p}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json() }))
      .then(({ ok, d }) => {
        if (cancelado) return;
        if (ok) { setCustoLocal(d); setSemTaxaLocal(null); }
        else { setCustoLocal(null); setSemTaxaLocal(d?.error ?? 'sem taxas locais'); }
      })
      .catch(() => { if (!cancelado) { setCustoLocal(null); setSemTaxaLocal('falha ao consultar as taxas locais'); } });
    return () => { cancelado = true; };
  }, [selecionada, containers, ptax]);

  const buscar = async (over?: { pol: string; pod: string }) => {
    setCarregando(true);
    setErro(null);
    setSelecionada(null);
    try {
      const p = new URLSearchParams();
      const polAlvo = over?.pol ?? pol;
      const podAlvo = over?.pod ?? pod;
      if (polAlvo) p.set('pol', polAlvo);
      if (podAlvo) p.set('pod', podAlvo);
      if (equipamento) p.set('equipamento', equipamento);
      if (peso.trim()) { p.set('peso', peso.trim()); p.set('pesoBase', pesoBase); }
      if (carga) p.set('carga', carga);
      if (!somenteVigentes) p.set('incluirExpiradas', 'true');
      const r = await fetch(`/api/freight/quotes?${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'falha na consulta');
      setCotacoes(d.cotacoes);
      publicarEvidencia(d.cotacoes, polAlvo, podAlvo);
      // Abre o detalhamento já na melhor opção: o painel nunca fica ocioso.
      if (d.cotacoes.length) setSelecionada(d.cotacoes[0]);
    } catch (e) {
      setErro((e as Error).message);
      setCotacoes(null);
    } finally {
      setCarregando(false);
    }
  };

  /** Trilha auditável: de onde veio cada número mostrado na lista. */
  const publicarEvidencia = (cs: Cotacao[], polAlvo: string, podAlvo: string) => {
    if (!opts) return;
    const rota = `${polAlvo || 'todas as origens'} -> ${podAlvo || 'todos os destinos'}`;
    setEvidence({
      agent: 'costing',
      titulo: `Frete marítimo · ${rota}`,
      steps: [
        `Rate sheet "${opts.rateSheet.source_file}" (emissão ${opts.rateSheet.issued_on ?? 'não declarada'}).`,
        `${opts.totalCotacoes} cotações desagrupadas da planilha; filtro: ${rota}, ${equipamento || 'todos os equipamentos'}.`,
        peso.trim()
          ? `Peso de ${peso} t informado como ${pesoBase === 'VGM' ? 'VGM (com tara)' : 'peso de mercadoria'} — usado para liberar faixas de tarifa e taxas de excesso.`
          : 'Peso não informado: faixas condicionais de tarifa não foram aplicadas.',
        cs.length
          ? `Melhor custo total: ${cs[0].quote.carrier} ${usd(cs[0].totalUsd)} (aba "${cs[0].quote.source_sheet}", linha ${cs[0].quote.source_row}).`
          : 'Nenhuma cotação atende aos filtros.',
      ],
      citations: cs.slice(0, 5).map((c) => ({
        ref: `${c.quote.carrier} ${c.quote.pol}->${c.quote.pod}`,
        nota: `${c.quote.source_sheet}!L${c.quote.source_row} · ${usd(c.totalUsd)}`,
      })),
    });
  };

  const inverterRota = () => { setPol(pod); setPod(pol); };

  const salvarBusca = () => {
    try {
      localStorage.setItem('comexpilot.frete.busca',
        JSON.stringify({ pol, pod, equipamento, peso, pesoBase, carga, servico }));
      setBuscaSalva(true);
    } catch { /* modo privativo: nada a fazer */ }
  };

  const abrirCorredor = (c: Corredor) => {
    setPol(c.pol); setPod(c.pod); setVista('lista');
    buscar({ pol: c.pol, pod: c.pod });
  };

  /** Filtro de serviço + ordenação da aba ativa. */
  const lista = useMemo(() => {
    let l = cotacoes ?? [];
    if (servico) l = l.filter((c) => c.quote.service_type === servico);
    const copia = [...l];
    const susp = (c: Cotacao) => (temTarifaSuspeita(c) ? 1 : 0);
    if (aba === 'baratas') return copia.sort((a, b) => susp(a) - susp(b) || a.totalUsd - b.totalUsd);
    if (aba === 'rapidas') {
      // Ordena pelo trânsito ESTIMADO (distância real + penalidade de
      // transbordo). Sem coordenadas, a cotação vai para o fim.
      const dias = (c: Cotacao) => estimarTransito(c.quote)?.dias ?? 9_999;
      return copia.sort((a, b) => susp(a) - susp(b) || dias(a) - dias(b) || a.totalUsd - b.totalUsd);
    }
    return copia; // já vem ordenada por vigência + custo do backend
  }, [cotacoes, aba, servico]);

  /**
   * Arcos do mapa: as rotas da busca atual (uma por par de portos, com o menor
   * frete) ou, antes da primeira busca, a rede inteira de corredores.
   */
  /** Rede inteira convertida em arcos — fundo do mapa e fallback sem busca. */
  const arcosDaRede = useMemo<ArcoRota[]>(
    () => [...rede]
      .sort((a, b) => a.minUsd - b.minUsd)
      .slice(0, 90)
      .map((c) => ({
        chave: `${c.pol}|${c.pod}`,
        pol: c.pol, polName: c.polName, polLat: c.polLat, polLon: c.polLon,
        pod: c.pod, podName: c.podName, podLat: c.podLat, podLon: c.podLon,
        menorUsd: c.minUsd, carrier: c.melhorCarrier,
      })),
    [rede],
  );

  const arcos = useMemo<ArcoRota[]>(() => {
    if (cotacoes?.length) {
      const m = new Map<string, ArcoRota>();
      for (const c of cotacoes) {
        const k = chaveArco(c);
        const atual = m.get(k);
        if (atual && atual.menorUsd <= c.totalUsd) continue;
        const q = c.quote;
        m.set(k, {
          chave: k,
          pol: q.pol, polName: q.pol_name, polLat: q.pol_lat, polLon: q.pol_lon,
          pod: q.pod, podName: q.pod_name, podLat: q.pod_lat, podLon: q.pod_lon,
          menorUsd: c.totalUsd, carrier: q.carrier,
        });
      }
      return [...m.values()];
    }
    return arcosDaRede;
  }, [cotacoes, arcosDaRede]);

  // O piso de preço da lista ignora tarifas suspeitas: senão o selo "menor
  // custo" premiaria justamente o número corrompido.
  const maisBarata = useMemo(() => {
    const limpas = lista.filter((c) => !temTarifaSuspeita(c));
    return limpas.length ? Math.min(...limpas.map((c) => c.totalUsd)) : 0;
  }, [lista]);

  return (
    <section className="relative flex h-full flex-1 flex-col overflow-hidden bg-slate-50" id="freight-workspace">

      {/* ---------- Cabeçalho ---------- */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">
                Cotação de Frete Marítimo
              </h2>
              <p className="text-xs text-slate-400">
                {opts
                  ? `${opts.totalCotacoes.toLocaleString('pt-BR')} cotações desagrupadas de ${opts.rateSheet.source_file}`
                  : 'Carregando rate sheet...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle de visualização */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {([['lista', 'Lista', <FileText className="h-3.5 w-3.5" key="l" />],
                 ['mapa', 'Mapa de rotas', <MapIcon className="h-3.5 w-3.5" key="m" />]] as const).map(
                ([id, label, icone]) => (
                  <button
                    key={id}
                    onClick={() => setVista(id as Vista)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                      vista === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {icone}{label}
                  </button>
                ),
              )}
            </div>
            <button onClick={onClose} title="Fechar" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ---------- Barra de busca executiva ---------- */}
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <Campo rotulo="Origem (POL)" className="min-w-[150px] flex-1">
            <select value={pol} onChange={(e) => setPol(e.target.value)} className={SELECT}>
              <option value="">Todas as origens</option>
              {opts?.pols.map((p) => <option key={p.unlocode} value={p.unlocode}>{p.name}</option>)}
            </select>
          </Campo>

          <button
            onClick={inverterRota}
            title="Inverter origem e destino"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors duration-150 hover:border-sky-300 hover:text-sky-600"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>

          <Campo rotulo="Destino (POD)" className="min-w-[150px] flex-1">
            <select value={pod} onChange={(e) => setPod(e.target.value)} className={SELECT}>
              <option value="">Todos os destinos</option>
              {opts?.pods.map((p) => <option key={p.unlocode} value={p.unlocode}>{p.name}</option>)}
            </select>
          </Campo>

          <span className="mb-2 hidden h-6 w-px bg-slate-200 lg:block" />

          <Campo rotulo="Equipamento" className="min-w-[120px]">
            <select value={equipamento} onChange={(e) => setEquipamento(e.target.value)} className={SELECT}>
              <option value="">Todos</option>
              <option value="20GP">20&apos; GP</option>
              <option value="40GP">40&apos; GP</option>
              <option value="40HQ">40&apos; HQ</option>
              <option value="40NOR">40&apos; NOR</option>
              <option value="40RF">40&apos; Reefer</option>
              <option value="LCL">LCL (m³)</option>
            </select>
          </Campo>

          <Campo rotulo="Peso (t)" className="min-w-[130px]">
            <div className="flex gap-1">
              <input
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder="15"
                inputMode="decimal"
                className={`${SELECT} min-w-0 flex-1`}
              />
              {/* VGM inclui a tara. Sem este seletor a faixa de peso é aplicada
                  sobre a base errada e o desconto é glosado pelo armador. */}
              <select
                value={pesoBase}
                onChange={(e) => setPesoBase(e.target.value as 'CARGO' | 'VGM')}
                title="A tarifa condicional pode ser medida em peso de mercadoria ou em VGM (que inclui a tara do contêiner)"
                className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2 text-[11px] text-slate-600 outline-none focus:border-sky-500"
              >
                <option value="CARGO">carga</option>
                <option value="VGM">VGM</option>
              </select>
            </div>
          </Campo>

          {/* Quantidade governa o custo local: taxa por BL é cobrada uma vez,
              taxa por contêiner multiplica. Não vai na busca — só no cálculo
              do painel de detalhe, então mudar aqui não refaz a consulta. */}
          <Campo rotulo="Contêineres" className="min-w-[92px]">
            <input
              value={containers}
              onChange={(e) => setContainers(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="1"
              inputMode="numeric"
              title="Multiplica o frete e as taxas cobradas por contêiner; as taxas por BL são cobradas uma vez"
              className={SELECT}
            />
          </Campo>

          <button
            onClick={() => buscar()}
            disabled={carregando}
            className="mb-0.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-950 px-5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-sky-700 disabled:opacity-40"
          >
            {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Buscar fretes
          </button>
        </div>

        {/* ---------- Filtros rápidos ---------- */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Pill>
            <select value={servico} onChange={(e) => setServico(e.target.value)} className={PILL_SELECT}>
              <option value="">Todos os modos</option>
              <option value="Direct">Serviço direto</option>
              <option value="Transhipment">Com transbordo</option>
            </select>
          </Pill>
          <Pill ativo={somenteVigentes}>
            <select
              value={somenteVigentes ? 'sim' : 'nao'}
              onChange={(e) => setSomenteVigentes(e.target.value === 'sim')}
              className={PILL_SELECT}
            >
              <option value="sim">Apenas tarifas vigentes</option>
              <option value="nao">Incluir tarifas expiradas</option>
            </select>
          </Pill>
          <Pill>
            <select value={aba} onChange={(e) => setAba(e.target.value as Aba)} className={PILL_SELECT}>
              <option value="recomendadas">Ordenar por: Recomendado</option>
              <option value="baratas">Ordenar por: Menor custo</option>
              <option value="rapidas">Ordenar por: Serviço direto</option>
            </select>
          </Pill>
          <Pill>
            <select value={carga} onChange={(e) => setCarga(e.target.value)} className={PILL_SELECT}>
              <option value="">Carga geral</option>
              {opts?.cargas.map((c) => <option key={c} value={c}>{CARGA_LABEL[c] ?? c}</option>)}
            </select>
          </Pill>
          <button
            onClick={salvarBusca}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              buscaSalva
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-700'
            }`}
          >
            {buscaSalva ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {buscaSalva ? 'Busca salva' : 'Salvar busca'}
          </button>
        </div>
      </header>

      {/* ---------- Corpo: uma única barra de rolagem ---------- */}
      {/* O mapa (359px) mais o cabeçalho (290px) não deixavam altura para a
          lista: ela ficava com 13px visíveis. Agora tudo rola junto — o mapa
          sobe e sai, o painel da direita fica grudado no topo. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-3" id="freight-scroll">
      {vista === 'mapa' && (
        <div>
          <FreightMap
            arcos={arcos}
            contexto={cotacoes?.length ? arcosDaRede : []}
            selecionada={selecionada ? chaveArco(selecionada) : null}
            onSelecionarRota={(a) => {
              const alvo = (cotacoes ?? []).find((c) => chaveArco(c) === a.chave);
              if (alvo) setSelecionada(alvo);
              else buscar({ pol: a.pol, pod: a.pod });
            }}
            titulo={cotacoes ? 'Rotas da busca' : 'Rede de corredores'}
            altura={300}
          />
        </div>
      )}

      {/* ---------- Split view ---------- */}
      <div className="mt-3 flex gap-4">
        {/* Coluna esquerda — opções ranqueadas */}
        <div className="flex min-w-0 flex-[60] flex-col">
          {/* Abas grudam no topo ao rolar: trocar de ordenação não exige
              voltar para cima. */}
          <div className="sticky top-0 z-10 flex items-center gap-1 bg-slate-50/95 pb-2 backdrop-blur">
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                title={a.nota}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 ${
                  aba === a.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                {a.icone}{a.label}
              </button>
            ))}
            {cotacoes && (
              <span className="ml-auto text-[11px] text-slate-400">
                {lista.length} {lista.length === 1 ? 'opção' : 'opções'}
              </span>
            )}
          </div>
          <p className="pb-2 text-[10px] leading-relaxed text-slate-400">
            {ABAS.find((a) => a.id === aba)!.nota}
          </p>

          <div className="space-y-2.5">
            {erro && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
              </div>
            )}

            {!cotacoes && !erro && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 py-14 text-center">
                <Ship className="mx-auto h-8 w-8 stroke-1 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-600">Escolha origem, destino e equipamento</p>
                <p className="mt-1 text-xs text-slate-400">
                  Informe o peso para que as faixas de tarifa e as taxas de excesso entrem no total.
                </p>
              </div>
            )}

            {cotacoes && lista.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 py-14 text-center">
                <p className="text-sm font-semibold text-slate-600">Nenhuma tarifa atende aos filtros.</p>
                <p className="mt-1 text-xs text-slate-400">Afrouxe o modo de serviço ou inclua tarifas expiradas.</p>
              </div>
            )}

            {lista.map((c, i) => (
              <div key={c.quote.quote_id}>
                <CardOpcao
                  c={c}
                  posicao={i}
                  ehMaisBarata={c.totalUsd === maisBarata}
                  selecionada={selecionada?.quote.quote_id === c.quote.quote_id}
                  onSelecionar={() => setSelecionada(c)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita — card flutuante de detalhamento */}
        <div className="hidden w-[38%] min-w-[300px] shrink-0 self-start lg:block">
          <div className="sticky top-0 flex max-h-[calc(100vh-13rem)] flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-md">
            <PainelDetalhe
              c={selecionada}
              custoLocal={custoLocal}
              semTaxaLocal={semTaxaLocal}
              ptax={ptax}
              containers={Math.max(1, Number(containers) || 1)}
              onBooking={() => selecionada && setBooking(selecionada)}
              onCusteio={() =>
                selecionada && (() => {
                  const qtd = Math.max(1, Number(containers) || 1);
                  const internacional = selecionada.totalUsd * qtd;
                  // Sem PTAX o custo local não é somável — vai só o frete, e o
                  // painel de detalhe já avisou o operador do porquê.
                  const locais = ptax && custoLocal ? custoLocal.totalUsd : 0;
                  onExportarParaCusteio({
                    freteUsd: internacional + locais,
                    freteInternacionalUsd: internacional,
                    taxasLocaisUsd: locais,
                    containers: qtd,
                    usdBrl: ptax?.usdBrl,
                    porto: selecionada.quote.pod_name,
                    rotulo: `${selecionada.quote.carrier} ${selecionada.quote.pol_name} → ${selecionada.quote.pod_name} (${qtd}x ${selecionada.quote.equipment_type})`,
                  });
                })()
              }
            />
          </div>
        </div>
      </div>

      </div>

      {booking && <ModalBooking c={booking} onClose={() => setBooking(null)} />}
    </section>
  );
}

/* ------------------------------------------------------------------ */

const SELECT = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none transition-colors duration-150 focus:border-sky-500';
const PILL_SELECT = 'cursor-pointer bg-transparent pr-1 text-xs font-medium outline-none';

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</span>
      {children}
    </label>
  );
}

function Pill({ ativo, children }: { ativo?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 transition-colors duration-150 ${
      ativo ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'
    }`}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */

interface CardOpcaoProps {
  c: Cotacao;
  posicao: number;
  ehMaisBarata: boolean;
  selecionada: boolean;
  onSelecionar: () => void;
}

function CardOpcao({ c, posicao, ehMaisBarata, selecionada, onSelecionar }: CardOpcaoProps) {
  const q = c.quote;
  const st = STATUS_UI[c.status] ?? STATUS_UI.sem_validade;
  const taxas = c.totalUsd - c.tarifaAplicada;
  const direto = q.service_type === 'Direct';
  const transito = estimarTransito(q);
  const suspeita = temTarifaSuspeita(c);

  return (
    <button
      onClick={onSelecionar}
      className={`group block w-full rounded-xl border bg-white p-4 text-left transition-all duration-150 hover:-translate-y-px hover:border-indigo-300 hover:shadow-md ${
        selecionada
          ? 'border-indigo-400 shadow-md ring-1 ring-indigo-100'
          : 'border-slate-200/80 shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <BadgeArmador code={q.carrier} destaque={posicao === 0} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-slate-900">{q.carrier}</span>
            {/* Selo de vencedor nunca vai para uma tarifa que sabemos estar
                corrompida — ela ganha o aviso no lugar. */}
            {suspeita ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                <AlertTriangle className="h-2.5 w-2.5" /> dado suspeito
              </span>
            ) : (
              <>
                {posicao === 0 && (
                  <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    #1 recomendada
                  </span>
                )}
                {ehMaisBarata && posicao !== 0 && (
                  <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    menor custo
                  </span>
                )}
              </>
            )}
          </div>

          {/* Rota, trânsito e modo — a linha que responde "serve para mim?" */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Ship className="h-3.5 w-3.5 text-slate-300" />
              {q.pol_name} <ArrowRight className="h-3.5 w-3.5 text-slate-300" /> {q.pod_name}
            </span>
            {transito && (
              <>
                <span className="text-slate-200">|</span>
                <span
                  className="inline-flex items-center gap-1 text-slate-500"
                  title={transito.premissa}
                >
                  <Timer className="h-3.5 w-3.5" /> ~{transito.dias} dias
                  <span className="text-[10px] text-slate-400">(est.)</span>
                </span>
              </>
            )}
            <span className="text-slate-200">|</span>
            <span className={direto ? 'text-slate-500' : 'font-medium text-amber-600'}>
              {direto ? 'Direto' : q.service_type === 'Transhipment' ? 'Transbordo' : (q.service_name || '—')}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
              {q.equipment_type}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
              <Clock className="h-2.5 w-2.5" /> free time {freeTime(c)}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ${st.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {st.label}{q.validity_end ? ` até ${q.validity_end.slice(5).replace('-', '/')}` : ''}
            </span>
            {c.alertas.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">
                <AlertTriangle className="h-2.5 w-2.5" /> {c.alertas.length} ressalva(s)
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className={`block font-display text-xl font-bold tabular-nums tracking-tight ${
            suspeita ? 'text-slate-400 line-through decoration-rose-300' : 'text-emerald-600'
          }`}>
            {usd(c.totalUsd)}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            frete {usd(c.tarifaAplicada)}{taxas > 0 ? ` + ${usd(taxas)}` : ''}
          </span>
          {c.descontoPeso > 0 && (
            <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              −{usd(c.descontoPeso)} por peso
            </span>
          )}
          <span className="mt-1.5 block text-[11px] font-semibold text-indigo-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            ver detalhes →
          </span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Taxas locais de destino no painel de detalhe.
 *
 * O frete internacional cobre até o costado; THC, ISPS, drop off, BL fee e as
 * taxas do agente acontecem no porto brasileiro. Mostrar só o frete faz o
 * operador fechar um custeio que vai estourar na fatura.
 *
 * A separação BL × contêiner fica VISÍVEL porque é ela que explica por que
 * dobrar a carga não dobra a conta — e é o erro mais comum de quem soma na mão.
 */
function PainelTaxasLocais({ custo, indisponivel, ptax, freteUsd }: {
  custo: CustoLocal | null;
  indisponivel: string | null;
  ptax: { usdBrl: number; date: string } | null;
  freteUsd: number;
}) {
  if (indisponivel) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Taxas locais de destino</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {indisponivel} A base cobre 12 portos brasileiros. Sem esse dado o total abaixo é
          <strong className="font-semibold"> só o frete internacional</strong> — as taxas de destino
          ainda vão existir na fatura.
        </p>
      </div>
    );
  }
  if (!custo) return null;

  const grupos = porEntidade(custo);
  const semCambio = !ptax || ptax.usdBrl <= 0;
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <div className="mt-4 flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Taxas locais · {custo.portoNome}
        </p>
        <span className="text-[10px] text-slate-400">
          {custo.containers} ctr{custo.containers > 1 ? 's' : ''}
        </span>
      </div>

      <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200">
        {grupos.map((g) => (
          <div key={g.entidade}>
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{g.entidade}</span>
              <span className="text-[10px] text-slate-400">
                {g.tipo === 'CARRIER' ? 'armador' : 'agente de carga'}
              </span>
            </div>
            {g.linhas.map((l, i) => (
              <div key={`${l.fee_code}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-3 py-1.5 last:border-0">
                <div className="min-w-0">
                  <span className="block truncate text-xs text-slate-600">{l.fee_code}</span>
                  <span className="block text-[10px] text-slate-400">
                    {l.calculation_unit === 'CNTR'
                      ? `${l.currency} ${l.unitario.toLocaleString('pt-BR')} × ${custo.containers} ctr`
                      : 'uma vez por BL'}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-slate-700">
                  {l.currency === 'BRL' ? brl(l.total) : usd(l.total)}
                </span>
              </div>
            ))}
          </div>
        ))}

        <div className="space-y-1 bg-slate-50 px-3 py-2.5">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-slate-500">Em reais</span>
            <span className="font-mono tabular-nums text-slate-700">{brl(custo.porBlBrl + custo.porCntrBrl)}</span>
          </div>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-slate-500">Em dólares</span>
            <span className="font-mono tabular-nums text-slate-700">{usd(custo.porBlUsd + custo.porCntrUsd)}</span>
          </div>
        </div>
      </div>

      {/* Sem PTAX não somamos moedas: um câmbio chutado erra o custeio inteiro. */}
      {semCambio ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
          <p className="text-[11px] leading-relaxed text-amber-900">
            Sem a PTAX do dia não converto as duas moedas — os valores acima ficam separados.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-emerald-900">Custo total do frete</span>
            <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-emerald-700">
              {usd(freteUsd + custo.totalUsd)}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-emerald-800/70">
            frete {usd(freteUsd)} + taxas locais {usd(custo.totalUsd)} · PTAX {ptax!.usdBrl.toLocaleString('pt-BR', { minimumFractionDigits: 4 })} de {new Date(`${ptax!.date}T12:00:00`).toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}

      {custo.ressalvas.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            <AlertTriangle className="h-3 w-3" /> Ressalva nas taxas
          </p>
          <ul className="space-y-1">
            {custo.ressalvas.map((r, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-amber-900">• {r}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function PainelDetalhe({ c, onBooking, onCusteio, custoLocal, semTaxaLocal, ptax, containers }: {
  c: Cotacao | null;
  onBooking: () => void;
  onCusteio: () => void;
  custoLocal: CustoLocal | null;
  semTaxaLocal: string | null;
  ptax: { usdBrl: number; date: string } | null;
  containers: number;
}) {
  if (!c) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <FileText className="h-7 w-7 text-slate-200" />
        <p className="mt-2 text-sm font-medium text-slate-400">Detalhamento da cotação</p>
        <p className="mt-1 text-xs text-slate-300">Selecione uma opção à esquerda para ver a composição do custo e agir sobre ela.</p>
      </div>
    );
  }

  const q = c.quote;
  const st = STATUS_UI[c.status] ?? STATUS_UI.sem_validade;
  const transito = estimarTransito(q);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <BadgeArmador code={q.carrier} destaque />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-slate-900">{q.carrier}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-600">
              <Ship className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              {q.pol_name} <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" /> {q.pod_name}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${st.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
          </span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
            {q.equipment_type}
          </span>
          {transito && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
              title={transito.premissa}
            >
              <Timer className="h-2.5 w-2.5" /> ~{transito.dias} dias (est.)
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
            <Clock className="h-2.5 w-2.5" /> free time {freeTime(c)}
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Composição do custo</p>
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
          <div className="flex items-baseline justify-between bg-slate-50 px-3 py-3">
            <span className="text-xs font-semibold text-slate-700">
              Frete internacional{containers > 1 ? ` · ${containers} ctrs` : ''}
            </span>
            <span className="font-display text-xl font-bold tabular-nums tracking-tight text-slate-800">
              {usd(c.totalUsd * containers)}
            </span>
          </div>
        </div>

        <PainelTaxasLocais
          custo={custoLocal}
          indisponivel={semTaxaLocal}
          ptax={ptax}
          freteUsd={c.totalUsd * containers}
        />

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

        <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Condições</p>
        <dl className="space-y-1.5 text-xs">
          <Linha rotulo="Free time" valor={freeTime(c)} />
          <Linha rotulo="Serviço" valor={q.service_name || q.service_type} />
          <Linha rotulo="Validade" valor={q.validity_raw || '—'} />
          {q.vessel_ref && <Linha rotulo="Navio / viagem" valor={q.vessel_ref} />}
          {q.space_status && <Linha rotulo="Espaço" valor={q.space_status} />}
          {q.cargo_type && <Linha rotulo="Restrita a" valor={CARGA_LABEL[q.cargo_type] ?? q.cargo_type} />}
          <Linha rotulo="Fonte" valor={`${q.source_sheet} · linha ${q.source_row}`} />
        </dl>
      </div>

      <footer className="shrink-0 space-y-2 border-t border-slate-200/80 bg-slate-50/50 p-3">
        <button
          onClick={onBooking}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-indigo-700"
        >
          <Send className="h-4 w-4" /> Solicitar booking
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCusteio}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:text-sky-700"
          >
            <Calculator className="h-3.5 w-3.5" /> Importar para Custeio
          </button>
          <button
            onClick={() => window.print()}
            title="Gera o PDF pela caixa de impressão do navegador"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:border-slate-300"
          >
            <Printer className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </footer>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{rotulo}</dt>
      <dd className="min-w-0 break-words text-right text-slate-600">{valor}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Solicitação de booking.
 *
 * NÃO reserva praça: não há integração com armador. Monta o texto padrão que o
 * operador envia ao agente/armador, com tudo que a rate sheet fornece. Um botão
 * que dissesse "Reservar" sem reservar nada seria uma promessa falsa num
 * processo que move contêiner.
 */
function ModalBooking({ c, onClose }: { c: Cotacao; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const q = c.quote;
  const texto = [
    `SOLICITAÇÃO DE BOOKING — ${q.carrier}`,
    '',
    `Origem (POL): ${q.pol_name} (${q.pol})`,
    `Destino (POD): ${q.pod_name} (${q.pod})`,
    `Equipamento: ${q.equipment_type}`,
    `Serviço: ${q.service_name || q.service_type}`,
    q.vessel_ref ? `Navio / viagem: ${q.vessel_ref}` : '',
    '',
    `Frete cotado: ${usd(c.tarifaAplicada)}`,
    ...c.linhas.slice(1).map((l) => `${l.rotulo}: ${usd(l.valorUsd)}`),
    `Total estimado: ${usd(c.totalUsd)}`,
    '',
    `Free time: ${freeTime(c)}`,
    `Validade da tarifa: ${q.validity_raw || 'não declarada'}`,
    `Referência da tabela: ${q.source_sheet}, linha ${q.source_row}`,
    '',
    'Favor confirmar disponibilidade de praça, cut-off documental e ETD.',
  ].filter((l) => l !== undefined).join('\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sem permissão de área de transferência */ }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-6" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">Solicitação de booking</h3>
            <p className="text-[11px] text-slate-500">
              {q.carrier} · {q.pol_name} → {q.pod_name}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            O ComexPilot não tem integração com o armador: isto <strong>não reserva praça</strong>.
            Copie o texto abaixo e envie ao seu agente para confirmar disponibilidade.
          </p>
        </div>

        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-700">
          {texto}
        </pre>

        <footer className="flex gap-2 border-t border-slate-200 p-3">
          <button
            onClick={copiar}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-indigo-700"
          >
            {copiado ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {copiado ? 'Copiado' : 'Copiar solicitação'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
