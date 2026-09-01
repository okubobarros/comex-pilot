/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotas do SAT-Graph: teste de conexão e consulta de conformidade por NCM.
 */
import type { Request, Response } from 'express';
import { getDriver } from './neo4j.js';
import { getNcmInfo, getOrgaosAtivos, getStats, getTaPorNcm } from './satGraph.js';

/** Resumo da config em uso (nunca expõe a senha) — ajuda a diagnosticar 401. */
function configResumo() {
  const uri = process.env.NEO4J_URI || '(vazio)';
  const pass = process.env.NEO4J_PASSWORD || '';
  return {
    uri,
    instancia: (uri.match(/\/\/([^.]+)\./) || [])[1] ?? '(?)',
    user: process.env.NEO4J_USER || '(vazio)',
    database: process.env.NEO4J_DATABASE || '(default)',
    senha_caracteres: pass.length,
  };
}

function ensureConfigured(res: Response): boolean {
  if (!getDriver()) {
    res.status(503).json({ success: false, error: 'Neo4j não configurado — defina NEO4J_URI/USER/PASSWORD no .env.' });
    return false;
  }
  return true;
}

/** GET /api/sat-graph/test — conexão + stats + exemplo. */
export async function satGraphTestHandler(_req: Request, res: Response): Promise<void> {
  if (!ensureConfigured(res)) return;
  try {
    const [stats, orgaos, exemplo] = await Promise.all([getStats(), getOrgaosAtivos(), getTaPorNcm('84709010')]);
    res.json({ success: true, stats: stats.slice(0, 12), orgaos, exemplo_ncm_84709010: exemplo });
  } catch (err) {
    console.error('satGraphTest', err);
    res.status(502).json({ success: false, error: String((err as Error).message || err), config: configResumo() });
  }
}

/** GET /api/sat-graph/ncm/:code — conformidade (TAs/LPCO por órgão) de um NCM. */
export async function satGraphNcmHandler(req: Request, res: Response): Promise<void> {
  if (!ensureConfigured(res)) return;
  const code = String(req.params.code || '');
  if (!code.replace(/\D/g, '')) {
    res.status(400).json({ success: false, error: 'NCM inválido.' });
    return;
  }
  try {
    const ncm = await getNcmInfo(code);
    if (!ncm) {
      res.status(404).json({ success: false, error: `NCM ${code} não encontrado no grafo.` });
      return;
    }
    const tratamentos = await getTaPorNcm(code);
    const orgaos = new Set(tratamentos.map((t) => t.orgao_npi).filter(Boolean));
    res.json({ success: true, ncm, tratamentos, total_orgaos: orgaos.size });
  } catch (err) {
    console.error('satGraphNcm', err);
    res.status(502).json({ success: false, error: String((err as Error).message || err), config: configResumo() });
  }
}
