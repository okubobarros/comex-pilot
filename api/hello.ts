/** Diagnóstico: função mínima sem dependências do projeto. */
export default function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, runtime: process.version, vercel: !!process.env.VERCEL });
}
