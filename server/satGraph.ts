/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consultas do SAT-Graph (motor de conformidade aduaneira sobre o Neo4j).
 * SOMENTE LEITURA — não cria nem altera nós/relações (o grafo é de produção).
 * Modelo: (TreatmentRule)-[:APLICA_SOBRE]->(:NCMCode). O identificador do NCM
 * varia por carga (código puro ou prefixado) — ver ncmVariants abaixo.
 */
import { query } from './neo4j';

/**
 * O formato do identificador varia conforme a carga do grafo. Nesta instância os
 * NCMCode usam o código puro ("30023060"), mas outras cargas usam o prefixo
 * "NCM_CODE_". Geramos todas as variantes e deixamos o Cypher casar qualquer uma.
 */
function ncmVariants(code: string) {
  const d = String(code).replace(/\D/g, '');
  const dotted = d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : d;
  return { digits: d, dotted, prefixed: `NCM_CODE_${d}` };
}

/** Casa o nó de NCM por qualquer propriedade/formato usado nas cargas conhecidas. */
const MATCH_NCM = `
  MATCH (n:NCMCode)
  WHERE n.id IN $variants OR n.code IN $variants OR n.codigo IN $variants
`;

/** Tratamentos administrativos (TA/LPCO) que incidem sobre um NCM, por órgão. */
export function getTaPorNcm(code: string) {
  const v = ncmVariants(code);
  const cypher = `
    ${MATCH_NCM}
    WITH n LIMIT 1
    MATCH (rule)-[:APLICA_SOBRE]->(n)
    RETURN
      labels(rule)[0]                     AS orgao_label,
      rule.orgao_anuente                  AS orgao_npi,
      rule.orgao_nome_normalizado         AS orgao_nome,
      rule.ta_id                          AS ta_id,
      rule.codigo_modelo                  AS modelo,
      rule.nome_modelo_lpco               AS nome_modelo,
      rule.tipo_ta                        AS tipo_ta,
      rule.impede_desembaraco             AS impede_desembaraco,
      rule.prazo_validade_lpco            AS prazo,
      rule.base_legal_ta                  AS base_legal,
      rule.inicio_vigencia_ta             AS vigencia
    ORDER BY orgao_label, ta_id`;
  return query(cypher, { variants: [v.digits, v.dotted, v.prefixed] });
}

/** Descrição e código de um NCM. */
export async function getNcmInfo(code: string) {
  const v = ncmVariants(code);
  const cypher = `
    ${MATCH_NCM}
    RETURN n.id AS id,
           coalesce(n.description, n.descricao, n.descricao_ncm) AS descricao,
           coalesce(n.code, n.codigo, n.id) AS codigo
    LIMIT 1`;
  const rows = await query(cypher, { variants: [v.digits, v.dotted, v.prefixed] });
  return rows[0] ?? null;
}

/** Snapshot do banco por label (debug/health). */
export function getStats() {
  return query(`MATCH (n) RETURN labels(n)[0] AS label, count(n) AS total ORDER BY total DESC LIMIT 25`);
}

/** Órgãos anuentes com regras NCM ativas. */
export function getOrgaosAtivos() {
  return query(`
    MATCH (rule)-[:APLICA_SOBRE]->(:NCMCode)
    RETURN rule.orgao_anuente AS orgao, rule.orgao_nome_normalizado AS nome, count(rule) AS total_ncm
    ORDER BY total_ncm DESC`);
}
