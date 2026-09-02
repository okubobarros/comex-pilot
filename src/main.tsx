/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Ponto de entrada. Decide entre a landing page (`/`) e o produto (`/app`).
 *
 * POR QUE O APP ENTRA POR `lazy`
 * ------------------------------
 * Landing page é a porta de entrada de quem ainda não conhece o produto, e
 * quem espera fecha a aba. Sem a divisão abaixo, quem abre comexpilot.com
 * baixa o dashboard inteiro — copiloto, comparador de frete, mapa-múndi — só
 * para ler três parágrafos e clicar num botão. Com ela, o pacote do produto só
 * é buscado quando alguém realmente entra em /app.
 *
 * A landing também fica FORA dos providers de processo e evidência: são
 * estados do copiloto, e montá-los numa página de marketing é trabalho antes
 * da primeira pintura da tela que mais precisa ser rápida.
 */
import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LandingPage from './marketing/LandingPage';
import './index.css';
import { ouvirRota, rotaAtual } from './routes';

const App = lazy(() => import('./App.tsx'));
const ProcessProvider = lazy(() =>
  import('./context/ProcessContext').then((m) => ({ default: m.ProcessProvider })),
);
const EvidenceProvider = lazy(() =>
  import('./context/EvidenceContext').then((m) => ({ default: m.EvidenceProvider })),
);

/**
 * Espera do pacote do produto. Fundo igual ao do app para que a transição não
 * pisque branco — na prática dura o tempo de um fetch em cache.
 */
function Carregando() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
    </div>
  );
}

function Raiz() {
  const [rota, setRota] = useState(rotaAtual);

  useEffect(() => ouvirRota(() => setRota(rotaAtual())), []);

  if (rota === 'marketing') return <LandingPage />;

  return (
    <Suspense fallback={<Carregando />}>
      <ProcessProvider>
        <EvidenceProvider>
          <App />
        </EvidenceProvider>
      </ProcessProvider>
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
);
