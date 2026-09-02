/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Normas complementares — curadoria do ComexPilot sobre o Portal Único.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O tratamento administrativo do Portal Único cita a base legal "de cima": para
 * pneus, o TA I1076 do IBAMA lista Decreto 875/1993, Lei 12.305/2010 e as
 * Resoluções Conama 401/2008, 416/2009 e 452/2012. Nenhuma dessas normas diz ao
 * importador O QUE FAZER — quem diz é a Instrução Normativa IBAMA nº 9/2021,
 * que regulamenta a Conama 416/2009 e que o TA não menciona.
 *
 * O caso que motivou esta camada: o operador via "IBAMA · Alerta" e não sabia
 * se precisava de licença. Precisa saber duas coisas opostas ao mesmo tempo —
 * que a anuência prévia foi EXTINTA (art. 25) e que a obrigação de coleta e
 * destinação PERMANECE. Nenhuma das duas está no grafo.
 *
 * REGRAS DESTA CAMADA
 * -------------------
 *  - Toda entrada aponta a fonte oficial e a data de vigência.
 *  - O texto é transcrição/resumo da norma, não interpretação nossa.
 *  - A interface deixa explícito que é curadoria, separada do que veio do grafo.
 *  - Na dúvida, não se acrescenta: uma exigência inventada é tão danosa quanto
 *    uma exigência escondida.
 */

export interface NormaComplementar {
  /** Prefixo de NCM (só dígitos) a que a norma se aplica. Ex.: "4011". */
  ncmPrefixo: string;
  /** Sigla do órgão a que a norma se vincula, para agrupar com o TA. */
  orgao: string;
  identificacao: string;
  ementa: string;
  fonte: string;
  vigenciaDesde: string;
  /** A leitura de uma linha — o que muda para quem opera. */
  destaque: string;
  /** Fatos operativos, cada um com o artigo de origem. */
  pontos: string[];
}

export const NORMAS_COMPLEMENTARES: NormaComplementar[] = [
  {
    ncmPrefixo: '4011',
    orgao: 'IBAMA',
    identificacao: 'Instrução Normativa IBAMA 9/2021',
    ementa:
      'Institui, no âmbito do Ibama, os procedimentos necessários ao cumprimento da Resolução Conama '
      + 'nº 416/2009 pelos fabricantes e importadores de pneus novos, sobre coleta e destinação final '
      + 'de pneus inservíveis.',
    fonte: 'https://www.ibama.gov.br/component/legislacao/?view=legislacao&legislacao=138770',
    vigenciaDesde: '2021-08-02',
    destaque:
      'NÃO há anuência prévia do IBAMA no Siscomex para LI de pneus novos (art. 25). '
      + 'A obrigação que permanece é de coleta e destinação de pneus inservíveis, com declaração '
      + 'trimestral e meta anual — ela recai sobre o importador, não sobre o despacho.',
    pontos: [
      'Alcance: pneus novos com peso unitário superior a 2 kg na posição 4011 da NCM (art. 2º).',
      'Anuência prévia no Siscomex para LI de pneus novos: extinta (art. 25). A IN 01/2010 foi revogada (art. 27).',
      'O importador deve estar inscrito no Cadastro Técnico Federal — CTF/APP (art. 4º).',
      'Declaração trimestral por CNPJ no Relatório de Pneumáticos, com totais importados, exportados e '
        + 'enviados a montadoras, por NCM, em peso e unidade (art. 6º).',
      'Meta de destinação = [(fabricados + importados) − (exportados + enviados a montadoras)] × 0,70, em kg (art. 8º).',
      'Consolidação anual do relatório até 31 de março do ano seguinte (art. 13).',
      'Dispensa da coleta/destinação: admissão temporária, drawback, retorno de mercadorias, reimportação, '
        + 'entreposto aduaneiro, recof automotivo e aeronáutico, e retorno de exportação temporária — '
        + 'salvo se os pneus forem nacionalizados (art. 3º, I a VII e § 1º).',
      'Dispensa para pessoa física: até 5 unidades por ano, com peso unitário de até 40 kg (art. 3º, VIII).',
      'Importação por conta e ordem ou por encomenda: a obrigação é do adquirente ou encomendante '
        + 'predeterminado, e o importador deve encaminhar cópia do contrato (art. 10).',
      'Descumprimento da meta acumula obrigação para os períodos seguintes (art. 9º) e sujeita às sanções '
        + 'da Lei 9.605/1998 (art. 26).',
    ],
  },
];

const digitos = (s: string) => String(s ?? '').replace(/\D/g, '');

/** Normas complementares aplicáveis a um NCM, opcionalmente filtradas por órgão. */
export function complementaresPara(ncm: string, orgao?: string): NormaComplementar[] {
  const codigo = digitos(ncm);
  if (!codigo) return [];
  const sigla = (orgao ?? '').toUpperCase();
  return NORMAS_COMPLEMENTARES.filter(
    (n) => codigo.startsWith(n.ncmPrefixo) && (!sigla || sigla.includes(n.orgao)),
  );
}
