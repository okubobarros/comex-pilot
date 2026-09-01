/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Função serverless da Vercel. Carrega apenas o app de rotas (server/app.ts),
 * sem Vite nem estáticos — o front é servido pelo CDN da Vercel.
 */
import app from '../server/app.js';

export default app;
