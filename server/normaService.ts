/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consulta de norma por identificação (mcat.norma) — alimenta a citação clicável
 * do Painel de Evidências. GET /api/norma?ref=RDC 752/2022
 */
import type { Request, Response } from 'express';
import pg from 'pg';

let pool: pg.Pool | null = null;
function getPool(): pg.Pool | null {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new pg.Pool({ connectionString: url, max: 4 });
  return pool;
}

export async function normaHandler(req: Request, res: Response): Promise<void> {
  const p = getPool();
  if (!p) {
    res.status(503).json({ success: false, error: 'DATABASE_URL não configurada.' });
    return;
  }
  const ref = String(req.query.ref ?? '').trim();
  if (!ref) {
    res.status(400).json({ success: false, error: 'Parâmetro ref obrigatório.' });
    return;
  }
  try {
    const r = await p.query(
      `select identificacao, tipo, orgao_emissor, ementa, vigencia_inicio
         from mcat.norma
        where identificacao ilike $1
        order by vigencia_inicio desc nulls last limit 1`,
      [`%${ref}%`]
    );
    if (r.rowCount === 0) {
      res.status(404).json({ success: false, error: `Norma "${ref}" não encontrada.` });
      return;
    }
    res.json({ success: true, norma: r.rows[0] });
  } catch (err) {
    console.error('normaHandler', err);
    res.status(500).json({ success: false, error: 'Falha ao consultar a norma.' });
  }
}
