/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Serviço de custeio (backend): resolve as alíquotas versionadas no schema `mcat`
 * (por NCM/UF/data) e roda o motor puro `computeCosting`. Exposto em POST /api/costing.
 */
import type { Request, Response } from 'express';
import pg from 'pg';
import { computeCosting, CostingRates, Modal, ReformaRegra } from '../src/engine/costing';

let pool: pg.Pool | null = null;
function getPool(): pg.Pool | null {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new pg.Pool({ connectionString: url, max: 4 });
  return pool;
}

const digits = (s: string) => (s || '').replace(/[^0-9]/g, '');

interface ResolveArgs {
  ncm: string;
  uf: string;
  modal: Modal;
  qtdeAdicoes: number;
  dataFatoGerador: string; // YYYY-MM-DD
}

/** Busca as alíquotas reais nas tabelas mcat.*. Retorna null se o NCM não tiver tributo. */
async function resolveRates(p: pg.Pool, a: ResolveArgs): Promise<CostingRates | null> {
  const trib = await p.query(
    `select t.ii_pct, t.ipi_pct, t.pis_pct, t.cofins_pct
       from mcat.ncm_tributo t join mcat.ncm n on n.codigo = t.ncm_codigo
      where n.codigo_norm = $1 and t.vigencia_inicio <= $2::date
      order by t.vigencia_inicio desc limit 1`,
    [digits(a.ncm), a.dataFatoGerador]
  );
  if (trib.rowCount === 0) return null;

  const icms = await p.query(`select icms_pct from mcat.icms_uf where uf = $1`, [a.uf]);
  const afrmm = await p.query(`select aliquota_pct from mcat.afrmm_aliquota where modal = $1`, [a.modal]);
  const sisc = await p.query(
    `select valor_total from mcat.siscomex_taxa where qtde_adicoes = $1`, [a.qtdeAdicoes]
  );
  const reg = await p.query(
    `select cbs_pct, ibs_pct, cbs_compensavel, ibs_compensavel, pis_cofins_ativo, ipi_zerado, base_legal
       from mcat.ibs_cbs_regra
      where $1::date between vigencia_inicio and vigencia_fim
      order by vigencia_inicio desc limit 1`,
    [a.dataFatoGerador]
  );

  const t = trib.rows[0];
  const r = reg.rows[0];
  const reforma: ReformaRegra = r
    ? {
        cbsPct: Number(r.cbs_pct), ibsPct: Number(r.ibs_pct),
        cbsCompensavel: r.cbs_compensavel, ibsCompensavel: r.ibs_compensavel,
        pisCofinsAtivo: r.pis_cofins_ativo, ipiZerado: r.ipi_zerado, baseLegal: r.base_legal,
      }
    : { cbsPct: 0, ibsPct: 0, cbsCompensavel: true, ibsCompensavel: true, pisCofinsAtivo: true, ipiZerado: false };

  return {
    iiPct: Number(t.ii_pct ?? 0),
    ipiPct: Number(t.ipi_pct ?? 0),
    pisPct: Number(t.pis_pct ?? 0),
    cofinsPct: Number(t.cofins_pct ?? 0),
    icmsPct: icms.rowCount ? Number(icms.rows[0].icms_pct) : 0,
    afrmmPct: afrmm.rowCount ? Number(afrmm.rows[0].aliquota_pct) : 0,
    siscomexTotal: sisc.rowCount ? Number(sisc.rows[0].valor_total) : 0,
    reforma,
  };
}

export async function costingHandler(req: Request, res: Response): Promise<void> {
  const p = getPool();
  if (!p) {
    res.status(503).json({ success: false, error: 'DATABASE_URL não configurada — motor real indisponível.' });
    return;
  }
  try {
    const b = req.body ?? {};
    const args: ResolveArgs = {
      ncm: String(b.ncm ?? ''),
      uf: String(b.uf ?? 'SP'),
      modal: (b.modal as Modal) ?? 'longo_curso',
      qtdeAdicoes: Number(b.qtdeAdicoes ?? 1),
      dataFatoGerador: String(b.dataFatoGerador ?? new Date().toISOString().slice(0, 10)),
    };
    if (!digits(args.ncm)) {
      res.status(400).json({ success: false, error: 'NCM inválido.' });
      return;
    }
    const rates = await resolveRates(p, args);
    if (!rates) {
      res.status(404).json({ success: false, error: `NCM ${args.ncm} sem tributos cadastrados em mcat.` });
      return;
    }
    const result = computeCosting(
      {
        fobUsd: Number(b.fobUsd ?? 0),
        freightUsd: Number(b.freightUsd ?? 0),
        insuranceUsd: Number(b.insuranceUsd ?? 0),
        usdBrl: Number(b.usdBrl ?? 0),
        outrasDespesasBrl: Number(b.outrasDespesasBrl ?? 0),
      },
      rates
    );
    res.json({ success: true, result, rates, resolved: args });
  } catch (err) {
    console.error('costingHandler', err);
    res.status(500).json({ success: false, error: 'Falha ao calcular o custeio.' });
  }
}
