/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Entry point serverless da Vercel: reaproveita o mesmo app Express do
 * `server.ts` (mesmas rotas /api/*). Em dev local, o server.ts continua
 * escutando a porta normalmente — aqui ele é só exportado como handler.
 */
import app from '../server';

export default app;
