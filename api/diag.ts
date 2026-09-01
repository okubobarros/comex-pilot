/** Diagnóstico 2: descobre a forma correta de importar arquivos do projeto. */
import { readdirSync } from 'fs';
export default async function handler(_req: any, res: any) {
  const r: Record<string, string> = {};
  const t = async (n: string, fn: () => Promise<unknown>) => {
    try { await fn(); r[n] = 'ok'; } catch (e: any) { r[n] = 'ERRO: ' + (e?.message || String(e)).slice(0, 120); }
  };
  await t('sem extensao  ../server/llm', () => import('../server/llm'));
  await t('com .js       ../server/llm.js', () => import('../server/llm.js'));
  let arvore: any = {};
  try { arvore['/var/task'] = readdirSync('/var/task').slice(0, 25); } catch (e: any) { arvore.erro = e.message; }
  try { arvore['/var/task/server'] = readdirSync('/var/task/server').slice(0, 25); } catch (e: any) { arvore.server = 'inexistente'; }
  try { arvore['/var/task/api'] = readdirSync('/var/task/api').slice(0, 25); } catch (e: any) { arvore.api = e.message; }
  res.status(200).json({ imports: r, arvore });
}
