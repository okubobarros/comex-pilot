/** Diagnóstico: tenta carregar o app e REPORTA o erro real em vez de 500 opaco. */
export default async function handler(_req: any, res: any) {
  const etapas: Record<string, string> = {};
  const tenta = async (nome: string, fn: () => Promise<unknown>) => {
    try { await fn(); etapas[nome] = 'ok'; }
    catch (e: any) { etapas[nome] = 'ERRO: ' + (e?.message || String(e)).slice(0, 200); }
  };
  await tenta('express', () => import('express'));
  await tenta('pg', () => import('pg'));
  await tenta('neo4j-driver', () => import('neo4j-driver'));
  await tenta('@google/genai', () => import('@google/genai'));
  await tenta('cosmeticsDb', () => import('../src/data/cosmeticsDb'));
  await tenta('server/llm', () => import('../server/llm'));
  await tenta('server/app', () => import('../server/app'));
  res.status(200).json({ etapas });
}
