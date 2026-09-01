/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mapa do Monitor de Frete — canvas superior interativo.
 *
 * Os continentes vêm do Natural Earth 1:110m (domínio público), pré-projetados
 * por scripts/gen_world_path.mjs. Os portos são posicionados por
 * latitude/longitude REAIS na mesma projeção equiretangular, então pino e costa
 * batem.
 *
 * Sobre os arcos: eles ligam origem e destino com uma curva para o sul, que no
 * corredor Ásia–América do Sul acompanha grosso modo a rota do Cabo da Boa
 * Esperança. Ainda assim é um traçado ESQUEMÁTICO — a rate sheet não descreve a
 * derrota do navio, e o rodapé do mapa diz isso.
 */
import React, { useMemo, useState } from 'react';
import { Ship } from 'lucide-react';
import { CAMINHO_TERRA, MAPA, projX, projY } from './worldPath';

export interface ArcoRota {
  chave: string;
  pol: string; polName: string; polLat: number | null; polLon: number | null;
  pod: string; podName: string; podLat: number | null; podLon: number | null;
  menorUsd: number;
  carrier: string;
}

interface FreightMapProps {
  arcos: ArcoRota[];
  /**
   * Rede completa, desenhada bem apagada por trás. Uma busca que devolve UMA
   * rota deixaria o canvas quase vazio; o contexto mostra onde ela se situa no
   * corredor.
   */
  contexto?: ArcoRota[];
  /** Rota destacada — acende quando um card é selecionado na lista. */
  selecionada?: string | null;
  onSelecionarRota?: (a: ArcoRota) => void;
  altura?: number;
  /** Texto do canto superior esquerdo. */
  titulo: string;
}

const usd = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface Pino {
  code: string; nome: string; x: number; y: number;
  origem: boolean; menorUsd: number; carrier: string; rotas: number;
}

export default function FreightMap({
  arcos, contexto = [], selecionada, onSelecionarRota, altura = 380, titulo,
}: FreightMapProps) {
  const [hover, setHover] = useState<Pino | null>(null);
  const [hoverArco, setHoverArco] = useState<ArcoRota | null>(null);

  const validos = useMemo(
    () => arcos.filter((a) => a.polLat != null && a.podLat != null),
    [arcos],
  );

  /** Um pino por porto, guardando o menor frete que passa por ele. */
  const pinos = useMemo(() => {
    const m = new Map<string, Pino>();
    const por = (code: string, nome: string, lat: number, lon: number, origem: boolean, a: ArcoRota) => {
      const atual = m.get(code);
      if (atual) {
        atual.rotas += 1;
        if (a.menorUsd < atual.menorUsd) { atual.menorUsd = a.menorUsd; atual.carrier = a.carrier; }
        return;
      }
      m.set(code, {
        code, nome, x: projX(lon), y: projY(lat), origem,
        menorUsd: a.menorUsd, carrier: a.carrier, rotas: 1,
      });
    };
    for (const a of validos) {
      por(a.pol, a.polName, a.polLat!, a.polLon!, true, a);
      por(a.pod, a.podName, a.podLat!, a.podLon!, false, a);
    }
    return [...m.values()];
  }, [validos]);

  /**
   * Rótulos sem sobreposição: Shekou, Shenzhen, Yantian e Hong Kong ficam a
   * menos de meio grau. Percorre por relevância e só rotula quem não colide.
   */
  const rotulados = useMemo(() => {
    const postos: [number, number][] = [];
    const ok = new Set<string>();
    for (const p of [...pinos].sort((a, b) => Number(!a.origem) - Number(!b.origem) || b.rotas - a.rotas)) {
      if (postos.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 46)) continue;
      postos.push([p.x, p.y]);
      ok.add(p.code);
    }
    return ok;
  }, [pinos]);

  const chavesPrimarias = useMemo(() => new Set(validos.map((a) => a.chave)), [validos]);

  const caminhoArco = (a: ArcoRota) => {
    const x1 = projX(a.polLon!), y1 = projY(a.polLat!);
    const x2 = projX(a.podLon!), y2 = projY(a.podLat!);
    // Curvatura para o sul: no corredor Ásia–ECSA acompanha a rota do Cabo.
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + Math.min(Math.abs(x2 - x1) * 0.28, 190);
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  const foco = hoverArco ?? null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-[#f8fafc] shadow-sm">
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{titulo}</p>
        <p className="text-[10px] text-slate-300">
          {validos.length} {validos.length === 1 ? 'rota' : 'rotas'} · {pinos.length} portos
        </p>
      </div>

      <svg
        viewBox={`0 0 ${MAPA.largura} ${MAPA.altura}`}
        // "meet", não "slice": recortar deixaria o canvas mostrando só oceano
        // quando o painel de comando está aberto. O mapa inteiro sempre cabe.
        // A sobra lateral some porque o fundo do container é a mesma cor do mar.
        style={{ width: '100%', height: altura }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mapa de rotas de frete entre Ásia e América do Sul"
      >
        <defs>
          <linearGradient id="arcoGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="arcoAceso" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        <rect width={MAPA.largura} height={MAPA.altura} fill="#f8fafc" />

        {/* Grade discreta de coordenadas */}
        {[-30, 0, 30].map((lat) => (
          <line key={`la${lat}`} x1={0} x2={MAPA.largura} y1={projY(lat)} y2={projY(lat)}
                stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {[-60, 0, 60, 120].map((lon) => (
          <line key={`lo${lon}`} y1={0} y2={MAPA.altura} x1={projX(lon)} x2={projX(lon)}
                stroke="#e2e8f0" strokeWidth={1} />
        ))}

        {/* Continentes — Natural Earth 1:110m */}
        <path d={CAMINHO_TERRA} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={0.6} />

        {/* Rede de fundo — só contexto, sem interação */}
        <g fill="none" strokeLinecap="round" style={{ pointerEvents: 'none' }}>
          {contexto
            .filter((a) => a.polLat != null && a.podLat != null && !chavesPrimarias.has(a.chave))
            .map((a) => (
              <path key={`ctx-${a.chave}`} d={caminhoArco(a)} stroke="#94a3b8"
                    strokeWidth={0.7} strokeDasharray="3 7" opacity={0.28} />
            ))}
        </g>

        {/* Arcos da busca */}
        <g fill="none" strokeLinecap="round">
          {validos.map((a) => {
            const aceso = selecionada === a.chave;
            const realce = aceso || foco?.chave === a.chave;
            return (
              <path
                key={a.chave}
                d={caminhoArco(a)}
                stroke={realce ? 'url(#arcoAceso)' : 'url(#arcoGrad)'}
                strokeWidth={realce ? 2.6 : 1}
                strokeDasharray={realce ? undefined : '5 6'}
                opacity={realce ? 1 : selecionada ? 0.22 : 0.6}
                onMouseEnter={() => setHoverArco(a)}
                onMouseLeave={() => setHoverArco(null)}
                onClick={() => onSelecionarRota?.(a)}
                style={{ cursor: onSelecionarRota ? 'pointer' : 'default', transition: 'opacity 150ms' }}
              />
            );
          })}
        </g>

        {/* Pinos */}
        {pinos.map((p) => {
          const destaque = !!selecionada && validos.some(
            (a) => a.chave === selecionada && (a.pol === p.code || a.pod === p.code),
          );
          const r = p.origem ? 3.4 : 4.6;
          return (
            <g key={p.code}
               onMouseEnter={() => setHover(p)}
               onMouseLeave={() => setHover(null)}
               style={{ cursor: 'pointer' }}>
              {(destaque || hover?.code === p.code) && (
                <circle cx={p.x} cy={p.y} r={r + 5} fill={p.origem ? '#7c3aed' : '#0ea5e9'} opacity={0.16} />
              )}
              <circle
                cx={p.x} cy={p.y} r={r}
                fill={p.origem ? '#8b5cf6' : '#0ea5e9'}
                stroke="#ffffff" strokeWidth={1.4}
              />
              {/* Área de captura maior que o pino, para o hover não exigir mira */}
              <circle cx={p.x} cy={p.y} r={11} fill="transparent" />
              {rotulados.has(p.code) && (
                <text
                  x={p.x} y={p.y - r - 5}
                  textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 600 }}
                  fill={p.origem ? '#6d28d9' : '#0369a1'}
                >
                  {p.nome}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip flutuante do porto */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-lg"
          style={{
            left: `${(hover.x / MAPA.largura) * 100}%`,
            top: `${(hover.y / MAPA.altura) * altura - 12}px`,
          }}
        >
          <p className="text-[11px] font-semibold text-slate-900">{hover.nome}</p>
          <p className="text-[11px] text-slate-500">
            {usd(hover.menorUsd)} · <span className="font-medium text-slate-700">{hover.carrier}</span>
          </p>
          <p className="text-[9px] text-slate-400">
            {hover.rotas} {hover.rotas === 1 ? 'rota' : 'rotas'} · {hover.origem ? 'origem' : 'destino'}
          </p>
        </div>
      )}

      {/* Tooltip do arco */}
      {hoverArco && !hover && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-lg">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-900">
            <Ship className="h-3 w-3 text-indigo-500" />
            {hoverArco.polName} → {hoverArco.podName}
          </p>
          <p className="text-[11px] text-slate-500">
            a partir de {usd(hoverArco.menorUsd)} · {hoverArco.carrier}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-200/80 bg-white/70 px-3 py-1.5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> origem
          </span>
          <span className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> destino
          </span>
        </div>
        <p className="text-[9px] text-slate-400">
          Costas: Natural Earth 1:110m · portos em coordenadas reais · os arcos indicam origem e
          destino, não a derrota do navio
        </p>
      </div>
    </div>
  );
}
