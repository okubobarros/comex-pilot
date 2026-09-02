/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Roteamento entre a landing page e o produto.
 *
 * POR QUE NÃO TEM BIBLIOTECA DE ROTAS
 * -----------------------------------
 * São duas rotas, sem parâmetros e sem rotas aninhadas. Um react-router
 * inteiro para decidir entre duas telas custa mais em peso de bundle numa
 * página de marketing do que resolve. Se um dia houver /precos, /blog e
 * afins, a troca é local: só este arquivo e o `main.tsx` conhecem rota.
 *
 * O SUBDOMÍNIO app.* CONTINUA CAINDO NO PRODUTO
 * ---------------------------------------------
 * O mesmo deploy atende comexpilot.com e app.comexpilot.com. Sem o teste de
 * hostname abaixo, quem tem app.comexpilot.com nos favoritos passaria a abrir
 * a landing page — uma regressão silenciosa para quem já usa a ferramenta.
 * Então: na raiz, o subdomínio app.* abre o produto; qualquer outro host abre
 * o marketing.
 */

export type Rota = 'marketing' | 'app';

/** Caminho da aplicação. Um só lugar para mudar se virar /dashboard. */
export const CAMINHO_APP = '/app';

/** Evento interno de navegação — `popstate` só dispara em voltar/avançar. */
const EVENTO_NAVEGACAO = 'comexpilot:navegou';

export function rotaAtual(): Rota {
  if (typeof window === 'undefined') return 'marketing';
  const { pathname, hostname } = window.location;
  if (pathname === '/' || pathname === '') {
    return hostname.startsWith('app.') ? 'app' : 'marketing';
  }
  return 'app';
}

/**
 * Navega sem recarregar a página. O bundle já está na memória, então a troca
 * é instantânea — um `href` puro baixaria tudo de novo.
 */
export function navegarPara(caminho: string): void {
  if (window.location.pathname === caminho) return;
  window.history.pushState({}, '', caminho);
  window.dispatchEvent(new Event(EVENTO_NAVEGACAO));
  window.scrollTo(0, 0);
}

/** Assina as duas fontes de mudança de rota. Devolve a função de limpeza. */
export function ouvirRota(aoMudar: () => void): () => void {
  window.addEventListener('popstate', aoMudar);
  window.addEventListener(EVENTO_NAVEGACAO, aoMudar);
  return () => {
    window.removeEventListener('popstate', aoMudar);
    window.removeEventListener(EVENTO_NAVEGACAO, aoMudar);
  };
}
