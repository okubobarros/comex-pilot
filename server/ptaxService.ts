/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Câmbio PTAX ao vivo via API pública do Banco Central (Olinda) — sem chave.
 * GET /api/ptax?date=YYYY-MM-DD → { date, usdBrl, eurBrl, source }.
 * Se a data não tiver cotação (fim de semana/feriado), volta até 10 dias.
 */
import type { Request, Response } from 'express';

const BASE =
  process.env.BCB_PTAX_BASE ??
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';

/** BCB usa MM-DD-YYYY. */
function toBcb(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

async function cotacaoUsd(d: Date): Promise<number | null> {
  const url = `${BASE}/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${toBcb(d)}'&$format=json`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = (await r.json()) as { value?: { cotacaoVenda?: number }[] };
  return j.value?.[0]?.cotacaoVenda ?? null;
}

export async function ptaxHandler(req: Request, res: Response): Promise<void> {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const base = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(base.getTime())) {
      res.status(400).json({ success: false, error: 'Data inválida.' });
      return;
    }
    // Volta até 10 dias buscando a última cotação disponível.
    for (let i = 0; i < 10; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i);
      const usd = await cotacaoUsd(d);
      if (usd != null) {
        res.json({
          success: true,
          date: d.toISOString().slice(0, 10),
          usdBrl: usd,
          source: 'BCB/PTAX',
        });
        return;
      }
    }
    res.status(404).json({ success: false, error: 'Sem cotação PTAX nos últimos 10 dias.' });
  } catch (err) {
    console.error('ptaxHandler', err);
    res.status(502).json({ success: false, error: 'Falha ao consultar a PTAX do BCB.' });
  }
}
