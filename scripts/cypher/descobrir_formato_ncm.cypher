// ============================================================================
// DESCOBERTA — como o NCM está modelado neste grafo
// Rode UMA POR VEZ no Query Studio (database `neo4j`) e me mande o resultado.
// Todas são somente leitura.
// ============================================================================

// [A] Como é um NCMCode de verdade? (propriedades e valores reais)
MATCH (n:NCMCode) RETURN n LIMIT 3;

// [B] Quais propriedades existem no label NCMCode?
MATCH (n:NCMCode) WITH keys(n) AS k UNWIND k AS prop
RETURN DISTINCT prop ORDER BY prop;

// [C] Procurar a vacina de febre aftosa por CÓDIGO (tentando várias propriedades)
MATCH (n:NCMCode)
WHERE n.id = 'NCM_CODE_30023060'
   OR n.code = '30023060' OR n.codigo = '30023060'
   OR n.code = '3002.30.60' OR n.codigo = '3002.30.60'
   OR toString(n.id) CONTAINS '30023060'
RETURN n LIMIT 5;

// [D] Se [C] vier vazia: existe QUALQUER nó cujo id contenha 30023060?
MATCH (n) WHERE toString(n.id) CONTAINS '30023060' RETURN labels(n), n LIMIT 5;

// [E] De onde partem as relações APLICA_SOBRE? (o alvo é NCMCode mesmo?)
MATCH (rule)-[:APLICA_SOBRE]->(alvo)
RETURN labels(rule)[0] AS origem, labels(alvo)[0] AS destino, count(*) AS total
ORDER BY total DESC LIMIT 10;

// [F] Um exemplo REAL de regra + o NCM que ela aponta (a query do app, ao contrário)
MATCH (rule:AnvisaTreatmentRule)-[:APLICA_SOBRE]->(n)
RETURN keys(rule) AS props_da_regra, n.id AS ncm_id, keys(n) AS props_do_ncm
LIMIT 3;
