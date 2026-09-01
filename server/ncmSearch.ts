/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Classificação fiscal sobre o SAT-Graph: busca o NCM a partir da descrição do
 * produto, percorrendo as descrições oficiais dos 15.156 códigos (NCMOccurrence).
 *
 * A busca considera o CAMINHO hierárquico, não só a folha — "pneu de moto" só
 * é encontrado porque "Pneumáticos" está no pai (4011) e "motocicletas" na
 * folha (4011.40.00). Buscar apenas na folha traria "Motores" e "Cilindros
 * pneumáticos", que foi exatamente o erro do classificador por palavra-chave.
 */
import { query } from './neo4j.js';

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as', 'e', 'ou', 'the', 'of', 'for',
  'tipo', 'tipos', 'produto', 'produtos', 'novo', 'novos', 'usado', 'usados',
]);

/**
 * Extrai radicais dos termos relevantes. Encurtar o final aumenta o recall em
 * português (pneu→pneu, motocicleta→motocicl, protetores→protetor).
 */
export function termosDeBusca(texto: string): string[] {
  const limpo = (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ');
  const termos = limpo
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
    .map((t) => (t.length > 6 ? t.slice(0, t.length - 2) : t));
  return [...new Set(termos)].slice(0, 6);
}

export interface CandidatoNcm {
  ncm: string;
  codigo_canonical: string;
  descricao: string;
  caminho: string;
  hits: number;
  termos_total: number;
}

/**
 * Candidatos a NCM para uma descrição livre. Exige que pelo menos `minHits`
 * termos apareçam no caminho hierárquico — quanto mais termos casam, mais
 * específico o resultado.
 */
export async function buscarNcmPorDescricao(texto: string, limite = 6): Promise<CandidatoNcm[]> {
  const termos = termosDeBusca(texto);
  if (termos.length === 0) return [];
  // LIMIT não aceita parâmetro float do driver; usamos um inteiro validado.
  const lim = Math.max(1, Math.min(20, Math.trunc(limite)));

  // Casamento por limite de palavra (\b) — "aco" não pode casar dentro de "casco".
  // Pontuação: termo que aparece na PRÓPRIA folha vale mais que no ancestral,
  // porque indica especificidade e não só o capítulo.
  const cypher = `
    UNWIND $termos AS termo
    MATCH (m:NCMOccurrence)
      WHERE toLower(m.description_plain) =~ ('(?i).*\\\\b' + termo + '.*')
    MATCH (o:NCMOccurrence)
      WHERE o.is_leaf = true AND o.code_canonical STARTS WITH m.code_canonical
    WITH o, termo,
         CASE WHEN o.code_canonical = m.code_canonical THEN 2 ELSE 1 END AS peso
    // Peso MÁXIMO por termo: vários ancestrais casando o mesmo termo não podem
    // inflar o score (era o que fazia "Cilindros pneumáticos" ganhar de "pneu de moto").
    WITH o, termo, max(peso) AS pesoTermo
    WITH o, count(DISTINCT termo) AS hits, sum(pesoTermo) AS score
    WHERE hits >= $minHits
    OPTIONAL MATCH (a:NCMOccurrence)
      WHERE a.code_canonical <> o.code_canonical
        AND o.code_canonical STARTS WITH a.code_canonical
    WITH o, hits, score, collect(a.description_plain) AS ctx
    RETURN o.code_display     AS ncm,
           o.code_canonical   AS codigo_canonical,
           o.description_plain AS descricao,
           reduce(s = '', c IN ctx | s + c + ' › ') AS caminho,
           hits, score
    ORDER BY hits DESC, score DESC, o.code_canonical
    LIMIT ${lim}`;

  // Começa exigindo todos os termos; relaxa até achar algo (mantém a precisão
  // quando a descrição é rica e ainda responde quando é vaga).
  for (let min = Math.min(termos.length, 3); min >= 1; min--) {
    const rows = await query(cypher, { termos, minHits: min });
    if (rows.length > 0) {
      return rows.map((r) => ({
        ncm: String(r.ncm ?? ''),
        codigo_canonical: String(r.codigo_canonical ?? ''),
        descricao: String(r.descricao ?? ''),
        caminho: String(r.caminho ?? ''),
        hits: Number(r.hits ?? 0),
        termos_total: termos.length,
      }));
    }
  }
  return [];
}
