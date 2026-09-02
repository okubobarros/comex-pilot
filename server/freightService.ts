/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de cotação de frete marítimo.
 *
 * Fonte dos dados: a rate sheet do armador, desagrupada por
 * scripts/etl/parse_rate_sheet.py. O mesmo ETL emite dois artefatos com o MESMO
 * conteúdo — `src/data/freightRates.json` (embarcado) e
 * `seeds/0004_freight_rates.sql` (Postgres/Supabase) — então a origem é
 * intercambiável e o motor de cálculo é único (src/engine/freight.ts).
 *
 * Por padrão lê o JSON embarcado, que é o caminho coberto por testes. Com
 * `FREIGHT_SOURCE=db` e `DATABASE_URL` definidos, lê a view `mcat.v_freight_quotes`.
 *
 * Rotas:
 *   GET /api/freight/options  -> portos, armadores e equipamentos disponíveis
 *   GET /api/freight/quotes   -> cotações filtradas e ordenadas por custo total
 *   GET /api/freight/issues   -> trilha de qualidade da carga
 *   GET /api/freight/local-charges -> taxas locais do porto de destino
 */
import type { Request, Response } from 'express';
import pg from 'pg';
import dataset from '../src/data/freightRates.json' with { type: 'json' };
import taxasLocais from '../src/data/localCharges.json' with { type: 'json' };
import { cotar, ordenarPorCusto, FreightQuote, Surcharge } from '../src/engine/freight.js';
import { calcularCustoLocal } from '../src/engine/localCharges.js';
import type { ChargeIssue, LocalCharge } from '../src/engine/localCharges.js';

let pool: pg.Pool | null = null;
function getPool(): pg.Pool | null {
  if (process.env.FREIGHT_SOURCE !== 'db') return null;
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new pg.Pool({ connectionString: url, max: 4 });
  return pool;
}

/* ------------------------------------------------------------------ *
 * Fonte embarcada: junta rotas + tarifas no mesmo grão da view SQL.
 * ------------------------------------------------------------------ */
type RotaJson = (typeof dataset)['routes'][number];
type CotacaoJson = (typeof dataset)['quotes'][number];

const PORTOS = new Map(dataset.ports.map((p) => [p.unlocode, p]));

/** Ressalvas do ETL indexadas pela linha da planilha que as originou. */
const ISSUES_POR_LINHA = new Map<string, { kind: string; severity: string; detail: string }[]>();
for (const i of dataset.issues) {
  const k = `${i.sheet}|${i.source_row}`;
  ISSUES_POR_LINHA.set(k, [...(ISSUES_POR_LINHA.get(k) ?? []),
    { kind: i.kind, severity: i.severity, detail: i.detail }]);
}

let cache: FreightQuote[] | null = null;

function carregarEmbarcado(): FreightQuote[] {
  if (cache) return cache;
  const rotas = new Map<number, RotaJson>(dataset.routes.map((r) => [r.id, r]));
  cache = (dataset.quotes as CotacaoJson[]).flatMap((q) => {
    const r = rotas.get(q.route_id);
    if (!r) return [];
    const pol = PORTOS.get(r.pol);
    const pod = PORTOS.get(r.pod);
    if (!pol || !pod) return [];
    return [{
      quote_id: q.id,
      route_id: r.id,
      carrier: r.carrier,
      carrier_scope: r.carrier_scope ?? [],
      trade_lane: r.trade_lane,
      pol: r.pol, pol_name: pol.name, pol_lat: pol.lat, pol_lon: pol.lon,
      pod: r.pod, pod_name: pod.name, pod_country: pod.country,
      pod_lat: pod.lat, pod_lon: pod.lon,
      service_type: r.service_type,
      service_name: r.service_name,
      validity_start: r.validity_start,
      validity_end: r.validity_end,
      validity_raw: r.validity_raw,
      vessel_ref: r.vessel_ref,
      space_status: r.space_status,
      equipment_type: q.equipment_type,
      also_valid_for: q.also_valid_for,
      base_rate: q.base_rate,
      adjusted_rate: q.adjusted_rate,
      weight_operator: q.weight_operator,
      weight_limit_ton: q.weight_limit_ton,
      weight_basis: q.weight_basis,
      cargo_type: q.cargo_type,
      unit: q.unit,
      currency: q.currency,
      free_days_pol: r.free_days_pol,
      free_days_pod: r.free_days_pod,
      surcharges: r.surcharges as Surcharge[],
      source_sheet: r.sheet,
      source_row: r.source_row,
      data_issues: ISSUES_POR_LINHA.get(`${r.sheet}|${r.source_row}`) ?? [],
    } as FreightQuote];
  });
  return cache;
}

/* ------------------------------------------------------------------ *
 * Fonte Postgres: mesma forma, vinda de mcat.v_freight_quotes.
 * ------------------------------------------------------------------ */
async function carregarDoBanco(p: pg.Pool): Promise<FreightQuote[]> {
  const { rows } = await p.query(`
    select q.*, coalesce((
      select json_agg(json_build_object(
        'fee_code', s.fee_code, 'fee_label', s.fee_label, 'amount', s.amount,
        'currency', s.currency, 'charge_basis', s.charge_basis,
        'equipment_type', s.equipment_type, 'min_weight_ton', s.min_weight_ton,
        'condition_raw', s.condition_raw, 'source_column', s.source_column))
      from mcat.rate_surcharges s where s.route_id = q.route_id), '[]'::json) as surcharges
    from mcat.v_freight_quotes q`);
  return rows.map((r) => ({
    ...r,
    quote_id: r.quote_id, route_id: r.route_id,
    carrier_scope: r.carrier_scope ? String(r.carrier_scope).split(',') : [],
    also_valid_for: r.also_valid_for ? String(r.also_valid_for).split(',') : [],
    base_rate: Number(r.base_rate),
    adjusted_rate: r.adjusted_rate == null ? null : Number(r.adjusted_rate),
    weight_limit_ton: r.weight_limit_ton == null ? null : Number(r.weight_limit_ton),
    validity_start: r.validity_start ? new Date(r.validity_start).toISOString().slice(0, 10) : null,
    validity_end: r.validity_end ? new Date(r.validity_end).toISOString().slice(0, 10) : null,
    surcharges: (r.surcharges ?? []).map((s: Surcharge) => ({ ...s, amount: Number(s.amount) })),
  })) as FreightQuote[];
}

async function carregar(): Promise<FreightQuote[]> {
  const p = getPool();
  if (!p) return carregarEmbarcado();
  try {
    return await carregarDoBanco(p);
  } catch (e) {
    // Preferimos servir a base embarcada a derrubar a tela de cotação.
    console.error('[freight] falha ao ler do Postgres, usando base embarcada:', (e as Error).message);
    return carregarEmbarcado();
  }
}

const num = (v: unknown): number | undefined => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : undefined;
};

/** GET /api/freight/options — alimenta os seletores da tela. */
export async function freightOptionsHandler(_req: Request, res: Response) {
  try {
    const qs = await carregar();
    const pols = new Map<string, string>();
    const pods = new Map<string, string>();
    const equip = new Set<string>();
    const cargas = new Set<string>();
    for (const q of qs) {
      pols.set(q.pol, q.pol_name);
      pods.set(q.pod, q.pod_name);
      equip.add(q.equipment_type);
      if (q.cargo_type) cargas.add(q.cargo_type);
    }
    const ord = (m: Map<string, string>) =>
      [...m.entries()].map(([unlocode, name]) => ({ unlocode, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    res.json({
      pols: ord(pols),
      pods: ord(pods),
      carriers: [...new Set(qs.map((q) => q.carrier))].sort(),
      equipamentos: [...equip].sort(),
      cargas: [...cargas].sort(),
      rateSheet: dataset.rate_sheet,
      totalCotacoes: qs.length,
      fonte: getPool() ? 'postgres' : 'embarcada',
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/**
 * GET /api/freight/quotes
 *
 * Filtros: pol, pod, equipamento, carrier, carga, peso (t), pesoBase
 * (CARGO|VGM), cbm, incluirExpiradas, limite.
 */
export async function freightQuotesHandler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string>;
    const pesoTon = num(q.peso);
    const params = {
      pesoTon,
      pesoInformadoComo: (q.pesoBase === 'VGM' ? 'VGM' : 'CARGO') as 'VGM' | 'CARGO',
      cbm: num(q.cbm),
    };
    const equipAlvo = (q.equipamento || '').toUpperCase();
    const incluirExpiradas = q.incluirExpiradas === 'true';
    const limite = Math.min(num(q.limite) ?? 60, 300);

    let linhas = await carregar();
    if (q.pol) linhas = linhas.filter((l) => l.pol === q.pol);
    if (q.pod) linhas = linhas.filter((l) => l.pod === q.pod);
    if (q.carrier) linhas = linhas.filter((l) => l.carrier === q.carrier);
    if (equipAlvo) {
      // "40GP" casa com a tarifa da coluna 40'GP/40'HQ via `also_valid_for`.
      linhas = linhas.filter(
        (l) => l.equipment_type === equipAlvo || l.also_valid_for.includes(equipAlvo as never),
      );
    }
    // Sem filtro de carga, tarifas restritas (pneu, solar, têxtil, reefer) ficam
    // FORA: são preços de nicho que não valem para carga geral e distorceriam a
    // comparação para baixo.
    linhas = q.carga
      ? linhas.filter((l) => l.cargo_type === q.carga.toUpperCase())
      : linhas.filter((l) => !l.cargo_type);

    const cotacoes = ordenarPorCusto(linhas.map((l) => cotar(l, params)))
      .filter((c) => incluirExpiradas || c.status !== 'expirado');

    res.json({
      total: cotacoes.length,
      params: { ...params, equipamento: equipAlvo || null },
      cotacoes: cotacoes.slice(0, limite),
      fonte: getPool() ? 'postgres' : 'embarcada',
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/* ------------------------------------------------------------------ *
 * Taxas locais de destino
 * ------------------------------------------------------------------ */
const CHARGES = taxasLocais.charges as LocalCharge[];
const CHARGE_ISSUES = taxasLocais.issues as ChargeIssue[];

/**
 * GET /api/freight/local-charges
 *
 * Query: pod (UN/LOCODE), carrier, containers, usdBrl, incluirAgente.
 *
 * Devolve 404 — não um total zerado — quando o porto ou o armador não tem
 * taxa cadastrada. "Não sabemos" e "não custa nada" são respostas diferentes,
 * e um R$ 0,00 exibido como resultado é a pior das duas.
 */
export function freightLocalChargesHandler(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const pod = (q.pod || '').toUpperCase();
  const carrier = (q.carrier || '').toUpperCase();
  if (!pod || !carrier) {
    res.status(400).json({ error: 'Informe pod (UN/LOCODE) e carrier.' });
    return;
  }
  const custo = calcularCustoLocal(CHARGES, CHARGE_ISSUES, {
    pod,
    carrier,
    containers: num(q.containers) ?? 1,
    usdBrl: num(q.usdBrl) ?? 0,
    incluirAgente: q.incluirAgente !== 'false',
  });
  if (!custo) {
    res.status(404).json({
      error: `Sem taxas locais cadastradas para ${carrier} em ${pod}.`,
      pod,
      carrier,
      // A base cobre 12 portos brasileiros; dizer quais evita a impressão de
      // que a resposta vale para qualquer destino.
      portos_cobertos: [...new Set(CHARGES.map((c) => c.port_unlocode))].sort(),
    });
    return;
  }
  res.json({ ...custo, source_file: taxasLocais.source_file });
}

/** GET /api/freight/issues — o que o ETL não conseguiu afirmar com certeza. */
export function freightIssuesHandler(_req: Request, res: Response) {
  res.json({
    rateSheet: dataset.rate_sheet,
    total: dataset.issues.length,
    issues: dataset.issues,
  });
}

/* ------------------------------------------------------------------ *
 * Radar de Mercado
 * ------------------------------------------------------------------ */

const mediana = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * GET /api/freight/radar
 *
 * Visão de mercado por CORREDOR (par origem/destino), não por cotação: quantos
 * armadores servem, qual a dispersão de preço entre eles e quanto da oferta
 * está prestes a vencer.
 *
 * O `spread` é o sinal comercial central — um corredor com 30% de diferença
 * entre o menor e o maior preço é dinheiro deixado na mesa por quem não cota.
 *
 * Params: equipamento (default 40HQ), peso (t), pesoBase (CARGO|VGM).
 */
export async function freightRadarHandler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string>;
    const equipAlvo = (q.equipamento || '40HQ').toUpperCase();
    const params = {
      pesoTon: num(q.peso),
      pesoInformadoComo: (q.pesoBase === 'VGM' ? 'VGM' : 'CARGO') as 'VGM' | 'CARGO',
    };

    const linhas = (await carregar()).filter(
      (l) => !l.cargo_type
        && (l.equipment_type === equipAlvo || l.also_valid_for.includes(equipAlvo as never)),
    );

    // Expiradas ficam fora do retrato de mercado: não são oferta disponível.
    // Tarifas com ressalva de QUALIDADE também: a de USD 1.015 de Chongqing é um
    // dígito faltando na planilha e, deixada aqui, viraria um spread de 890% —
    // uma leitura de mercado inventada a partir de um erro de digitação.
    const todas = linhas.map((l) => cotar(l, params));
    const suspeita = (c: (typeof todas)[number]) =>
      (c.quote.data_issues ?? []).some((i) => i.kind === 'tarifa');
    const excluidasPorQualidade = todas.filter((c) => c.status !== 'expirado' && suspeita(c)).length;
    const vivas = todas.filter((c) => c.status !== 'expirado' && !suspeita(c));

    const porCorredor = new Map<string, typeof vivas>();
    for (const c of vivas) {
      const k = `${c.quote.pol}|${c.quote.pod}`;
      porCorredor.set(k, [...(porCorredor.get(k) ?? []), c]);
    }

    const corredores = [...porCorredor.values()].map((cs) => {
      const valores = cs.map((c) => c.totalUsd);
      const min = Math.min(...valores);
      const max = Math.max(...valores);
      const barato = cs.find((c) => c.totalUsd === min)!;
      const caro = cs.find((c) => c.totalUsd === max)!;
      const q0 = barato.quote;
      return {
        pol: q0.pol, polName: q0.pol_name, polLat: q0.pol_lat, polLon: q0.pol_lon,
        pod: q0.pod, podName: q0.pod_name, podPais: q0.pod_country,
        podLat: q0.pod_lat, podLon: q0.pod_lon,
        cotacoes: cs.length,
        armadores: new Set(cs.map((c) => c.quote.carrier)).size,
        minUsd: min,
        medianaUsd: Math.round(mediana(valores)),
        maxUsd: max,
        spreadPct: min > 0 ? Math.round(((max - min) / min) * 1000) / 10 : 0,
        melhorCarrier: barato.quote.carrier,
        piorCarrier: caro.quote.carrier,
        expirando: cs.filter((c) => c.status === 'expirando').length,
      };
    }).sort((a, b) => b.spreadPct - a.spreadPct);

    // Portos com o papel que exercem, para dimensionar os pontos no mapa.
    const portos = new Map<string, {
      unlocode: string; name: string; pais: string; lat: number | null; lon: number | null;
      papel: 'POL' | 'POD'; corredores: number; menorUsd: number;
    }>();
    const anota = (
      code: string, name: string, pais: string, lat: number | null, lon: number | null,
      papel: 'POL' | 'POD', menor: number,
    ) => {
      const a = portos.get(code);
      if (a) { a.corredores += 1; a.menorUsd = Math.min(a.menorUsd, menor); return; }
      portos.set(code, { unlocode: code, name, pais, lat, lon, papel, corredores: 1, menorUsd: menor });
    };
    for (const c of corredores) {
      anota(c.pol, c.polName, c.pol.slice(0, 2), c.polLat, c.polLon, 'POL', c.minUsd);
      anota(c.pod, c.podName, c.podPais, c.podLat, c.podLon, 'POD', c.minUsd);
    }

    const spreads = corredores.map((c) => c.spreadPct).filter((s) => s > 0);
    const precos = corredores.map((c) => c.minUsd);

    res.json({
      rateSheet: dataset.rate_sheet,
      equipamento: equipAlvo,
      kpis: {
        corredores: corredores.length,
        armadores: new Set(vivas.map((c) => c.quote.carrier)).size,
        origens: [...portos.values()].filter((p) => p.papel === 'POL').length,
        destinos: [...portos.values()].filter((p) => p.papel === 'POD').length,
        cotacoes: vivas.length,
        expirando: vivas.filter((c) => c.status === 'expirando').length,
        spreadMedianoPct: spreads.length ? Math.round(mediana(spreads) * 10) / 10 : 0,
        excluidasPorQualidade,
        menorUsd: precos.length ? Math.min(...precos) : 0,
        maiorUsd: precos.length ? Math.max(...precos) : 0,
      },
      portos: [...portos.values()],
      corredores,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}
