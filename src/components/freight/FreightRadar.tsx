/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Radar de Mercado — retrato da oferta de frete por CORREDOR (par origem/destino).
 *
 * A tela de cotação responde "quanto custa esta rota". Esta responde outra
 * pergunta: "onde o mercado está caro, concentrado ou disperso". O sinal central
 * é o SPREAD — a diferença entre o menor e o maior preço no mesmo corredor. Um
 * corredor com 30% de spread é dinheiro deixado na mesa por quem fecha sem cotar.
 *
 * Sobre o mapa: os portos são posicionados por latitude/longitude REAIS em
 * projeção equiretangular. Os arcos são ESQUEMÁTICOS — a rate sheet não descreve
 * a derrota do navio, e desenhar uma rota fictícia com aparência de precisa seria
 * pior do que não desenhar. Por isso não há contorno de continentes: só a grade
 * de coordenadas e as regiões nomeadas.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Loader2, Radar, Search, TrendingUp, Users,
} from 'lucide-react';

export interface Corredor {
  pol: string; polName: string; polLat: number | null; polLon: number | null;
  pod: string; podName: string; podPais: string;
  podLat: number | null; podLon: number | null;
  cotacoes: number; armadores: number;
  minUsd: number; medianaUsd: number; maxUsd: number; spreadPct: number;
  melhorCarrier: string; piorCarrier: string; expirando: number;
}

interface RadarData {
  equipamento: string;
  kpis: {
    corredores: number; armadores: number; origens: number; destinos: number;
    cotacoes: number; expirando: number; spreadMedianoPct: number;
    menorUsd: number; maiorUsd: number; excluidasPorQualidade: number;
  };
  portos: { unlocode: string; name: string; pais: string; lat: number | null; lon: number | null; papel: 'POL' | 'POD'; corredores: number; menorUsd: number }[];
  corredores: Corredor[];
}

interface FreightRadarProps {
  /** Leva o corredor escolhido para a aba de cotação, já filtrado. */
  onAbrirCorredor: (c: Corredor) => void;
}

const usd = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/* --- Projeção equiretangular sobre o recorte Ásia ⇄ América do Sul --------- */
const MAPA = { w: 900, h: 380, lonMin: -70, lonMax: 128, latMin: -38, latMax: 44 };
const px = (lon: number) => ((lon - MAPA.lonMin) / (MAPA.lonMax - MAPA.lonMin)) * MAPA.w;
const py = (lat: number) => ((MAPA.latMax - lat) / (MAPA.latMax - MAPA.latMin)) * MAPA.h;

/** Faixas nomeadas em vez de contornos inventados. */
const REGIOES = [
  { nome: 'AMÉRICA DO SUL', lon: -52, lat: -14 },
  { nome: 'ATLÂNTICO SUL', lon: -20, lat: -26 },
  { nome: 'ÁFRICA', lon: 18, lat: 4 },
  { nome: 'OCEANO ÍNDICO', lon: 72, lat: -18 },
  { nome: 'ÁSIA', lon: 100, lat: 34 },
];

const TIERS = [
  { limite: 0.33, cor: '#059669', rotulo: 'mais barato' },
  { limite: 0.66, cor: '#d97706', rotulo: 'intermediário' },
  { limite: 1.01, cor: '#e11d48', rotulo: 'mais caro' },
];

export default function FreightRadar({ onAbrirCorredor }: FreightRadarProps) {
  const [equipamento, setEquipamento] = useState('40HQ');
  const [peso, setPeso] = useState('');
  const [d, setD] = useState<RadarData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [podSel, setPodSel] = useState<string | null>(null);
  const [hover, setHover] = useState<Corredor | null>(null);
  const [ordem, setOrdem] = useState<'spread' | 'preco'>('spread');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const p = new URLSearchParams({ equipamento });
      if (peso.trim()) p.set('peso', peso.trim());
      const r = await fetch(`/api/freight/radar?${p}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'falha ao carregar o radar');
      setD(j);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [equipamento]);

  /** Cor por tercil de preço, calculado sobre o conjunto exibido. */
  const corDe = useMemo(() => {
    const v = (d?.corredores ?? []).map((c) => c.minUsd).sort((a, b) => a - b);
    return (preco: number) => {
      if (!v.length) return TIERS[1].cor;
      const pos = v.findIndex((x) => x >= preco) / v.length;
      return (TIERS.find((t) => pos <= t.limite) ?? TIERS[2]).cor;
    };
  }, [d]);

  const destinos = useMemo(() => {
    const m = new Map<string, { pod: string; nome: string; n: number; menor: number }>();
    for (const c of d?.corredores ?? []) {
      const a = m.get(c.pod);
      if (a) { a.n += 1; a.menor = Math.min(a.menor, c.minUsd); }
      else m.set(c.pod, { pod: c.pod, nome: c.podName, n: 1, menor: c.minUsd });
    }
    return [...m.values()].sort((a, b) => a.menor - b.menor);
  }, [d]);

  const visiveis = useMemo(
    () => (d?.corredores ?? []).filter((c) => !podSel || c.pod === podSel),
    [d, podSel],
  );

  /**
   * Quais origens ganham rótulo no mapa.
   *
   * Shekou, Shenzhen, Yantian, Nansha e Hong Kong estão a menos de meio grau
   * umas das outras: rotular todas vira um borrão. Percorre por relevância e
   * só rotula quem não colide com um rótulo já posto — assim o critério é
   * geométrico, e não uma lista fixa que quebraria na próxima rate sheet.
   */
  const rotulados = useMemo(() => {
    const postos: [number, number][] = [];
    const ok = new Set<string>();
    const cands = (d?.portos ?? [])
      .filter((p) => p.papel === 'POL' && p.lat != null)
      .sort((a, b) => b.corredores - a.corredores);
    for (const p of cands) {
      const x = px(p.lon!), y = py(p.lat!);
      if (postos.some(([a, b]) => Math.hypot(a - x, b - y) < 42)) continue;
      postos.push([x, y]);
      ok.add(p.unlocode);
    }
    return ok;
  }, [d]);

  const tabela = useMemo(
    () => [...visiveis].sort((a, b) => (ordem === 'spread'
      ? b.spreadPct - a.spreadPct || a.minUsd - b.minUsd
      : a.minUsd - b.minUsd)),
    [visiveis, ordem],
  );

  if (carregando && !d) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Montando o retrato de mercado...
      </div>
    );
  }
  if (erro) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
      </div>
    );
  }
  if (!d) return null;

  const k = d.kpis;

  return (
    <div>
      {/* Controles */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
        <Radar className="h-4 w-4 shrink-0 text-sky-500" />
        <select
          value={equipamento}
          onChange={(e) => setEquipamento(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none focus:border-sky-500"
        >
          <option value="20GP">20&apos; GP</option>
          <option value="40HQ">40&apos; GP / HQ</option>
          <option value="40NOR">40&apos; NOR</option>
          <option value="40RF">40&apos; Reefer</option>
        </select>
        <input
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && carregar()}
          placeholder="peso (t)"
          inputMode="decimal"
          className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 outline-none focus:border-sky-500"
        />
        <button
          onClick={carregar}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
        >
          {carregando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          Atualizar
        </button>
        {podSel && (
          <button
            onClick={() => setPodSel(null)}
            className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500 transition hover:bg-slate-50"
          >
            limpar destino
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi rotulo="Corredores ativos" valor={String(k.corredores)}
             nota={`${k.origens} origens → ${k.destinos} destinos`} />
        <Kpi rotulo="Spread mediano" valor={`${k.spreadMedianoPct}%`}
             nota="diferença entre o menor e o maior preço" destaque />
        <Kpi rotulo="Faixa de preço" valor={usd(k.menorUsd)}
             nota={`até ${usd(k.maiorUsd)} por contêiner`} />
        <Kpi rotulo="Armadores" valor={String(k.armadores)}
             nota={k.excluidasPorQualidade > 0
               ? `${k.excluidasPorQualidade} tarifas fora por ressalva`
               : `${k.cotacoes} cotações no radar`} />
      </div>

      {/* Mapa */}
      <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Corredores {podSel ? `→ ${destinos.find((x) => x.pod === podSel)?.nome}` : 'Ásia → América do Sul'}
          </p>
          <div className="flex items-center gap-3">
            {TIERS.map((t) => (
              <span key={t.rotulo} className="flex items-center gap-1 text-[9px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.cor }} />
                {t.rotulo}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${MAPA.w} ${MAPA.h}`} className="w-full" role="img"
               aria-label="Mapa de corredores de frete entre Ásia e América do Sul">
            {/* Grade de coordenadas */}
            {[-30, -15, 0, 15, 30].map((lat) => (
              <line key={`la${lat}`} x1={0} x2={MAPA.w} y1={py(lat)} y2={py(lat)}
                    stroke={lat === 0 ? '#334155' : '#1e293b'} strokeWidth={lat === 0 ? 1 : 0.5} />
            ))}
            {[-60, -30, 0, 30, 60, 90, 120].map((lon) => (
              <line key={`lo${lon}`} y1={0} y2={MAPA.h} x1={px(lon)} x2={px(lon)}
                    stroke="#1e293b" strokeWidth={0.5} />
            ))}
            {REGIOES.map((r) => (
              <text key={r.nome} x={px(r.lon)} y={py(r.lat)} textAnchor="middle"
                    className="fill-slate-700" style={{ fontSize: 10, letterSpacing: 1.5 }}>
                {r.nome}
              </text>
            ))}

            {/* Arcos — esquemáticos, ver cabeçalho do arquivo */}
            {visiveis.map((c) => {
              if (c.polLat == null || c.podLat == null) return null;
              const x1 = px(c.polLon!), y1 = py(c.polLat);
              const x2 = px(c.podLon!), y2 = py(c.podLat);
              const cx = (x1 + x2) / 2;
              const cy = (y1 + y2) / 2 + 90;   // curvatura para o sul, lado do Cabo
              const ativo = hover?.pol === c.pol && hover?.pod === c.pod;
              return (
                <path
                  key={`${c.pol}-${c.pod}`}
                  d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                  fill="none"
                  stroke={corDe(c.minUsd)}
                  strokeWidth={ativo ? 2 : 0.7}
                  opacity={ativo ? 0.95 : podSel ? 0.4 : 0.16}
                  onMouseEnter={() => setHover(c)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}

            {/* Portos */}
            {d.portos.filter((p) => p.lat != null).map((p) => {
              const destino = p.papel === 'POD';
              const r = Math.min(2 + Math.sqrt(p.corredores) * 0.7, 7);
              const apagado = podSel && destino && p.unlocode !== podSel;
              return (
                <g key={p.unlocode} opacity={apagado ? 0.25 : 1}
                   onClick={() => destino && setPodSel(podSel === p.unlocode ? null : p.unlocode)}
                   style={{ cursor: destino ? 'pointer' : 'default' }}>
                  <circle cx={px(p.lon!)} cy={py(p.lat!)} r={r}
                          fill={destino ? '#38bdf8' : '#64748b'}
                          stroke={destino ? '#0ea5e9' : 'none'} strokeWidth={0.8} />
                  {(destino || rotulados.has(p.unlocode)) && (
                    <text x={px(p.lon!)} y={py(p.lat!) - r - 3} textAnchor="middle"
                          className={destino ? 'fill-sky-200' : 'fill-slate-500'}
                          style={{ fontSize: 8 }}>
                      {p.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hover && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-200 shadow-xl">
              <p className="font-semibold">{hover.polName} → {hover.podName}</p>
              <p className="mt-0.5 text-slate-400">
                {usd(hover.minUsd)} ({hover.melhorCarrier}) · {hover.armadores} armador(es) · spread {hover.spreadPct}%
              </p>
            </div>
          )}
        </div>

        <p className="border-t border-slate-800 px-3 py-1.5 text-[9px] leading-relaxed text-slate-600">
          Portos em coordenadas reais (projeção equiretangular). Os arcos indicam origem e destino,
          não a derrota efetiva do navio — a rate sheet não a descreve.
        </p>
      </div>

      {/* Destinos */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {destinos.map((x) => (
          <button
            key={x.pod}
            onClick={() => setPodSel(podSel === x.pod ? null : x.pod)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ${
              podSel === x.pod
                ? 'border-sky-300 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-700'
            }`}
          >
            {x.nome} <span className="font-mono text-[9px] text-slate-400">{usd(x.menor)}</span>
          </button>
        ))}
      </div>

      {/* Ranking de corredores */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {visiveis.length} corredores
          </p>
          <div className="flex gap-1">
            {(['spread', 'preco'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOrdem(o)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors duration-150 ${
                  ordem === o ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                {o === 'spread' ? 'maior dispersão' : 'menor preço'}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2 font-semibold">Corredor</th>
                <th className="px-3 py-2 font-semibold">Oferta</th>
                <th className="px-3 py-2 text-right font-semibold">Menor</th>
                <th className="px-3 py-2 text-right font-semibold">Mediana</th>
                <th className="px-3 py-2 text-right font-semibold">Maior</th>
                <th className="px-3 py-2 text-right font-semibold">Dispersão</th>
              </tr>
            </thead>
            <tbody>
              {tabela.slice(0, 120).map((c) => (
                <tr
                  key={`${c.pol}-${c.pod}`}
                  onMouseEnter={() => setHover(c)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onAbrirCorredor(c)}
                  className="cursor-pointer border-b border-slate-100 transition-colors duration-150 last:border-0 hover:bg-sky-50/60"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 text-xs text-slate-700">
                      {c.polName} <ArrowRight className="h-3 w-3 text-slate-300" /> {c.podName}
                    </div>
                    <span className="font-mono text-[10px] text-slate-300">{c.pol} · {c.pod}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
                      c.armadores === 1
                        ? 'bg-amber-50 text-amber-700 ring-amber-100'
                        : 'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}>
                      <Users className="h-2.5 w-2.5" />
                      {c.armadores} {c.armadores === 1 ? 'armador' : 'armadores'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-semibold tabular-nums text-slate-900">{usd(c.minUsd)}</span>
                    <span className="block text-[10px] text-emerald-600">{c.melhorCarrier}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-500">{usd(c.medianaUsd)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-xs tabular-nums text-slate-500">{usd(c.maxUsd)}</span>
                    <span className="block text-[10px] text-slate-400">{c.piorCarrier}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.spreadPct > 0 ? (
                      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                        c.spreadPct >= 15 ? 'bg-rose-50 text-rose-700'
                          : c.spreadPct >= 5 ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <TrendingUp className="h-2.5 w-2.5" />{c.spreadPct}%
                      </span>
                    ) : <span className="text-[11px] text-slate-300">—</span>}
                    {c.spreadPct >= 15 && (
                      <span className="block text-[9px] text-rose-500">
                        {usd(c.maxUsd - c.minUsd)} de diferença
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tabela.length > 120 && (
          <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
            mostrando 120 de {tabela.length} — filtre por destino para reduzir
          </p>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
        Tarifas expiradas e as {d.kpis.excluidasPorQualidade} com ressalva de qualidade ficam fora
        do radar: uma delas é um dígito faltando na planilha que, se contabilizado, viraria um
        spread de 890%. Clique num corredor para cotá-lo.
      </p>
    </div>
  );
}

function Kpi({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${destaque ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</p>
      <p className={`mt-0.5 font-display text-lg font-semibold tracking-tight ${destaque ? 'text-sky-700' : 'text-slate-900'}`}>
        {valor}
      </p>
      <p className="text-[10px] leading-tight text-slate-400">{nota}</p>
    </div>
  );
}
