/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Camada de modelo de linguagem: Gemini como primário e OpenRouter como
 * REDUNDÂNCIA (não substituto) quando o Gemini falha por rate limit/quota.
 *
 * Ambos os modelos são configuráveis por env — trocar de modelo não exige
 * mudança de código:
 *   GEMINI_MODEL      (default: gemini-3.5-flash)
 *   OPENROUTER_MODEL  (default: meta-llama/llama-3.3-70b-instruct:free)
 *   OPENROUTER_API_KEY — sem chave, o fallback é simplesmente pulado.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

/** Erros que justificam tentar o fallback (rate limit, quota, indisponibilidade). */
export function isRateLimitOrQuota(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  const status = e?.status ?? e?.code;
  if (status === 429 || status === 503 || status === 500) return true;
  const msg = String(e?.message || err || '').toLowerCase();
  return /rate.?limit|quota|resource.?exhausted|overload|too many requests|unavailable/.test(msg);
}

/**
 * Chama o OpenRouter (API compatível com OpenAI). Devolve o texto ou null se
 * não houver chave configurada / a chamada falhar.
 */
export async function callOpenRouter(prompt: string, opts: { json?: boolean } = {}): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null; // sem chave → fallback pulado, por desenho
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://comex-pilot.vercel.app',
        'X-Title': 'ComexPilot',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!resp.ok) {
      console.error('OpenRouter falhou:', resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error('OpenRouter erro:', err);
    return null;
  }
}

/** Extrai o primeiro objeto/array JSON de uma resposta em texto livre. */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/[[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
