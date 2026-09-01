/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Entrada de desenvolvimento/produção self-hosted: pega o app com as rotas de
 * API (server/app.ts) e acrescenta o Vite (dev) ou os estáticos (prod), então
 * escuta a porta. Na Vercel quem entra é api/index.ts, que usa só o app.
 */

import express, { Request, Response } from "express";
import path from "path";
import app from "./server/app.js";

const PORT = Number(process.env.PORT ?? 3000);

// Vite Integration for Full-Stack development / Production assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Serving static build files from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ComexPilot backend and frontend running on http://localhost:${PORT}`);
  });
}

// Na Vercel o app roda como função serverless (api/index.ts); localmente, escuta a porta.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
