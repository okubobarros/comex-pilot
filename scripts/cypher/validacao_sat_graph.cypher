// ============================================================================
// SAT-Graph — queries de validação
// Cole UMA DE CADA VEZ no Query Studio (console.neo4j.io > Query) ou na
// extensão Neo4j do VS Code, e devolva o resultado.
// Objetivo: confirmar os nomes REAIS de labels/propriedades usados pelo app.
// SOMENTE LEITURA — nenhuma dessas queries escreve no grafo.
// ============================================================================

// [1] Tamanho do grafo (sanidade)
MATCH (n) RETURN count(n) AS total_nos;

// [2] Labels e contagens — confirma nomes tipo AnvisaTreatmentRule, NCMCode...
MATCH (n)
RETURN labels(n)[0] AS label, count(n) AS total
ORDER BY total DESC LIMIT 25;

// [3] Um NCM de exemplo: quais propriedades existem de verdade?
MATCH (n:NCMCode {id: 'NCM_CODE_30023060'})
RETURN keys(n) AS propriedades, n LIMIT 1;

// [4] Se a [3] vier vazia, o id tem outro formato — descubra assim:
MATCH (n:NCMCode) RETURN n.id AS id, keys(n) AS props LIMIT 5;

// [5] A relação principal existe? (regra -> NCM)
MATCH (rule)-[:APLICA_SOBRE]->(n:NCMCode {id: 'NCM_CODE_30023060'})
RETURN labels(rule)[0] AS label_regra, keys(rule) AS props_regra LIMIT 3;

// [6] A CONSULTA DO APP (é exatamente esta que a rota /api/sat-graph/ncm usa)
MATCH (rule)-[:APLICA_SOBRE]->(n:NCMCode {id: 'NCM_CODE_30023060'})
RETURN
  labels(rule)[0]             AS orgao_label,
  rule.orgao_anuente          AS orgao_npi,
  rule.orgao_nome_normalizado AS orgao_nome,
  rule.ta_id                  AS ta_id,
  rule.codigo_modelo          AS modelo,
  rule.nome_modelo_lpco       AS nome_modelo,
  rule.tipo_ta                AS tipo_ta,
  rule.impede_desembaraco     AS impede_desembaraco,
  rule.prazo_validade_lpco    AS prazo,
  rule.base_legal_ta          AS base_legal,
  rule.inicio_vigencia_ta     AS vigencia
ORDER BY orgao_label, ta_id;

// [7] Órgãos com regras ativas (alimenta o painel)
MATCH (rule)-[:APLICA_SOBRE]->(:NCMCode)
RETURN rule.orgao_anuente AS orgao, count(rule) AS total_ncm
ORDER BY total_ncm DESC;

// [8] Nome do database em uso (confirma NEO4J_DATABASE)
CALL db.info() YIELD name RETURN name;
