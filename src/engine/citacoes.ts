/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extração de citações normativas a partir do texto de base legal.
 *
 * Vivia duplicado em duas telas, cada uma com um regex próprio e ambas
 * devolvendo só a PRIMEIRA norma. Foi assim que a base dos pneus — cinco normas,
 * incluindo a Resolução Conama 416/2009 que rege pneus inservíveis — chegou à
 * tela reduzida a "Decreto 875/1993", dando a impressão de citação errada.
 *
 * Módulo puro, sem React: dá para testar com npm run test:citacoes.
 */

function tipoCanonico(t: string): string {
  const n = t.trim().replace(/\s+/g, ' ');
  const mapa: Record<string, string> = {
    'resoluções': 'Resolução', 'resolucoes': 'Resolução', 'resolução': 'Resolução', 'resolucao': 'Resolução',
    'decretos': 'Decreto', 'decreto': 'Decreto',
    'leis': 'Lei', 'lei': 'Lei',
    'portarias': 'Portaria', 'portaria': 'Portaria',
    'instruções normativas': 'Instrução Normativa', 'instrução normativa': 'Instrução Normativa',
  };
  return mapa[n.toLowerCase()] ?? n;
}

const TIPO_NORMA =
  /(Resoluções|Resolução|Decreto[- ]Lei|Decretos|Decreto|Leis|Lei|Portarias|Portaria|Instruções Normativas|Instrução Normativa|IN RFB|IN|RDC|LC)\s*(Conama|Secex|Gecex|Camex|Anvisa)?/gi;

/**
 * Formato por extenso, usado pelo MAPA: "nº 24.114, de 12/04/1934".
 *
 * Precisa ser consumido ANTES do formato curto, senão o "12/04" da data vira
 * uma norma inexistente ("Decreto 12/2004") e a verdadeira (24.114/1934) some.
 */
const EXTENSO = /(?:n[º°.]?\s*)?(\d[\d.]*)\s*,\s*de\s+\d{1,2}\s*[/.]\s*\d{1,2}\s*[/.]\s*(\d{4})/g;
/** Formato curto: "875/1993". */
const NUMERO_ANO = /(\d[\d.]*)\s*\/\s*(\d{2,4})/g;

/**
 * TODAS as normas citadas numa base legal.
 *
 * Antes isto devolvia só a PRIMEIRA e o resto sumia. O caso que expôs o
 * problema veio dos pneus: o grafo entrega
 *
 *   "Decreto 875/1993, Lei 12.305/2010, Resoluções Conama 401/2008, 416/2009 e 452/2012"
 *
 * e a tela mostrava apenas "Decreto 875/1993" como se fosse A base. O decreto
 * existe e é pertinente (promulga a Convenção de Basileia), mas sozinho, para
 * pneus, parece deslocado — e a norma que de fato rege pneus inservíveis, a
 * Resolução Conama 416/2009, era descartada em silêncio. Numa contestação, a
 * citação incompleta é pior que a citação ausente.
 *
 * O parser também resolve listas com prefixo compartilhado: em "Resoluções
 * Conama 401/2008, 416/2009 e 452/2012" o tipo aparece uma vez e vale para os
 * três números.
 */
export function extractRefs(baseLegal?: string | null): string[] {
  if (!baseLegal) return [];
  const texto = String(baseLegal).replace(/\s+/g, ' ');

  // Onde cada tipo de norma aparece — cada marca governa o texto até a próxima.
  const marcas: { i: number; fim: number; tipo: string; orgao: string }[] = [];
  TIPO_NORMA.lastIndex = 0;
  for (let m = TIPO_NORMA.exec(texto); m; m = TIPO_NORMA.exec(texto)) {
    marcas.push({
      i: m.index,
      fim: m.index + m[0].length,
      tipo: tipoCanonico(m[1]),
      orgao: (m[2] ?? '').trim(),
    });
  }
  if (marcas.length === 0) return [];

  const refs: string[] = [];
  const anexar = (marca: { tipo: string; orgao: string }, num: string, ano: string) => {
    const completo = ano.length === 2 ? `${Number(ano) > 50 ? '19' : '20'}${ano}` : ano;
    const rotulo = [marca.tipo, marca.orgao, `${num}/${completo}`].filter(Boolean).join(' ');
    if (!refs.includes(rotulo)) refs.push(rotulo);
  };

  marcas.forEach((marca, idx) => {
    const ate = idx + 1 < marcas.length ? marcas[idx + 1].i : texto.length;
    let trecho = texto.slice(marca.fim, ate);

    // Primeiro o formato por extenso, apagando o que consumir para que a data
    // embutida não seja lida como número de norma.
    EXTENSO.lastIndex = 0;
    const extensos: [string, string][] = [];
    for (let e = EXTENSO.exec(trecho); e; e = EXTENSO.exec(trecho)) extensos.push([e[1], e[2]]);
    if (extensos.length) {
      trecho = trecho.replace(EXTENSO, ' ');
      extensos.forEach(([num, ano]) => anexar(marca, num, ano));
    }

    NUMERO_ANO.lastIndex = 0;
    for (let n = NUMERO_ANO.exec(trecho); n; n = NUMERO_ANO.exec(trecho)) anexar(marca, n[1], n[2]);
  });

  return refs;
}

/** Primeira norma da base legal. Mantido para quem só precisa de uma. */
export function extractRef(baseLegal?: string | null): string | null {
  return extractRefs(baseLegal)[0] ?? null;
}
