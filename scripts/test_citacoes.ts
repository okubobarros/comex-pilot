/**
 * Teste da extração de citações normativas (src/engine/citacoes.ts).
 * Roda com: npm run test:citacoes
 *
 * Cada caso é uma string REAL de `base_legal_ta` vinda do SAT-Graph. O primeiro
 * é o que gerou a reclamação: a tela mostrava só "Decreto 875/1993" para pneus,
 * e a norma que rege pneus inservíveis (Conama 416/2009) sumia.
 */
import { extractRef, extractRefs } from '../src/engine/citacoes';

let falhas = 0;
const eq = (nome: string, got: unknown, exp: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) falhas++;
  console.log(`  ${ok ? 'OK ' : 'FAIL'}  ${nome}`);
  if (!ok) console.log(`         got=${JSON.stringify(got)}\n         exp=${JSON.stringify(exp)}`);
};

console.log('Pneus — Brasil, TA I1076 do IBAMA (o caso que motivou a correção):');
eq('as cinco normas, não só a primeira',
  extractRefs('Decreto 875/1993, Lei 12.305/2010, Resoluções Conama 401/2008, 416/2009 e 452/2012.'),
  ['Decreto 875/1993', 'Lei 12.305/2010', 'Resolução Conama 401/2008',
   'Resolução Conama 416/2009', 'Resolução Conama 452/2012']);
eq('a norma dos pneus inservíveis está entre elas',
  extractRefs('Decreto 875/1993, Lei 12.305/2010, Resoluções Conama 401/2008, 416/2009 e 452/2012.')
    .includes('Resolução Conama 416/2009'),
  true);

console.log('\nOutros formatos que o grafo entrega:');
eq('pneus usados (TA I1086)',
  extractRefs('Lei 12.305/2010, Resolução Conama 452/2012'),
  ['Lei 12.305/2010', 'Resolução Conama 452/2012']);
eq('norma única com "nº"', extractRefs('RDC nº 752/2022'), ['RDC 752/2022']);
eq('tipos diferentes na mesma frase',
  extractRefs('Portaria Secex nº 23/2011 e IN RFB 1.600/2015'),
  ['Portaria Secex 23/2011', 'IN RFB 1.600/2015']);

// O MAPA escreve por extenso, com a data no meio. Sem tratar isso, o "12/04"
// da data viraria a norma "Decreto 12/2004" e a verdadeira se perderia.
console.log('\nFormato por extenso do MAPA — a data não pode virar norma:');
eq('dois decretos, nenhum falso',
  extractRefs('Decretos nº 24.114, de 12/04/1934, nº 24.548, de 03/07/1934'),
  ['Decreto 24.114/1934', 'Decreto 24.548/1934']);
eq('nenhum resultado com ano de 2 dígitos vindo de data',
  extractRefs('Decretos nº 24.114, de 12/04/1934').some((r) => r.includes('/2004')),
  false);

console.log('\nBordas:');
eq('base vazia', extractRefs(null), []);
eq('texto sem norma', extractRefs('Consultar o órgão anuente.'), []);
eq('ano de 2 dígitos vira século certo', extractRefs('Lei 9782/99'), ['Lei 9782/1999']);
eq('extractRef ainda devolve a primeira',
  extractRef('Decreto 875/1993, Lei 12.305/2010'), 'Decreto 875/1993');
eq('sem duplicar quando a norma se repete',
  extractRefs('Lei 12.305/2010 e Lei 12.305/2010'), ['Lei 12.305/2010']);

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
