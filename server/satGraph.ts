/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consultas do SAT-Graph (motor de conformidade aduaneira sobre o Neo4j).
 * SOMENTE LEITURA — não cria nem altera nós/relações (o grafo é de produção).
 * Modelo: (TreatmentRule)-[:APLICA_SOBRE]->(:NCMCode {id:"NCM_CODE_<digitos>"}).
 */
import { query } from './neo4j';

const ncmId = (code: string) => `NCM_CODE_${String(code).replace(/\D/g, '')}`;

/** Tratamentos administrativos (TA/LPCO) que incidem sobre um NCM, por órgão. */
export function getTaPorNcm(code: string) {
  const cypher = `
    MATCH (rule)-[:APLICA_SOBRE]->(n:NCMCode {id: $ncm_id})
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
  return query(cypher, { ncm_id: ncmId(code) });
}

/** Descrição e código de um NCM. */
export async function getNcmInfo(code: string) {
  const cypher = `
    MATCH (n:NCMCode {id: $ncm_id})
    RETURN n.id AS id, coalesce(n.description, n.descricao) AS descricao, coalesce(n.code, n.codigo) AS codigo`;
  const rows = await query(cypher, { ncm_id: ncmId(code) });
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
