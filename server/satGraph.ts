/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consultas do SAT-Graph (motor de conformidade aduaneira sobre o Neo4j).
 * SOMENTE LEITURA — não cria nem altera nós/relações (o grafo é de produção).
 *
 * Modelo real (validado na instância c36586f0):
 *   (:NCMCode {id:"NCM_CODE_<code_canonical>", code_canonical})
 *   (TreatmentRule)-[:APLICA_SOBRE]->(:NCMCode)
 *   (:NCMOccurrence {code_canonical, code_display, description_plain})
 *
 * IMPORTANTE: cada órgão foi carregado com um schema próprio — DECEX segue o
 * padrão NPI (ta_id, tipo_ta, impede_desembaraco), ANVISA usa
 * categoria_regulatoria/fundamentacao_legal/lpco_unico, MAPA usa
 * descricao/procedimento_*. Por isso normalizamos aqui, derivando o órgão do
 * label (sempre confiável) e mapeando os campos equivalentes.
 */
import { query } from './neo4j.js';

/** Label do nó → nome do órgão anuente. */
const ORGAO_POR_LABEL: Record<string, string> = {
  AnvisaTreatmentRule: 'ANVISA',
  MAPATreatmentRule: 'MAPA',
  MapaTreatmentRule: 'MAPA',
  IbamaTreatmentRule: 'IBAMA',
  InmetroTreatmentRule: 'INMETRO',
  DecexTreatmentRule: 'DECEX',
  SecexTreatmentRule: 'SECEX',
  DpfTreatmentRule: 'DPF/SIPROQUIM',
  DfpcTreatmentRule: 'DFPC (Exército)',
  MctiTreatmentRule: 'MCTI/CIBES',
  MinDefesaTreatmentRule: 'MIN. DEFESA',
  CnenTreatmentRule: 'CNEN/ANSN',
  AnpTreatmentRule: 'ANP',
  AneelTreatmentRule: 'ANEEL',
  EctTreatmentRule: 'ECT/Correios',
  DnpmAnmTreatmentRule: 'ANM (ex-DNPM)',
  CnpqTreatmentRule: 'CNPq',
  AncineTreatmentRule: 'ANCINE (histórico)',
};

export function orgaoDoLabel(label: string): string {
  return ORGAO_POR_LABEL[label] ?? label.replace(/TreatmentRule$/, '');
}

/** "3304.99.90" | "33049990" → id no formato do grafo. */
const ncmId = (code: string) => `NCM_CODE_${String(code).replace(/\D/g, '')}`;

/**
 * Tratamentos administrativos que incidem sobre um NCM.
 * Os coalesce cobrem os diferentes schemas de cada órgão.
 */
export async function getTaPorNcm(code: string) {
  const cypher = `
    MATCH (rule)-[:APLICA_SOBRE]->(n:NCMCode {id: $id})
    RETURN
      labels(rule)[0] AS orgao_label,
      coalesce(rule.orgao_anuente, rule.orgao)                              AS orgao_npi,
      coalesce(rule.ta_id, rule.codigo_ta)                                  AS ta_id,
      coalesce(rule.tipo_ta, rule.categoria_regulatoria, rule.descricao)    AS tipo_ta,
      coalesce(rule.codigo_modelo, rule.lpco_unico, rule.nome_modelo_lpco)  AS modelo,
      rule.impede_desembaraco                                               AS impede_desembaraco,
      coalesce(rule.base_legal_ta, rule.fundamentacao_legal)                AS base_legal,
      coalesce(rule.inicio_vigencia_ta, rule.data_inicio_vigencia)          AS vigencia,
      rule.prazo_validade_lpco                                              AS prazo,
      rule.duimp AS duimp, rule.inspecao AS inspecao, rule.ncm_scope AS escopo,
      coalesce(rule.rule_id, rule.id)                                       AS rule_id
    ORDER BY orgao_label, ta_id`;
  const rows = await query(cypher, { id: ncmId(code) });
  // Órgão sempre preenchido: usa o do NPI quando existe, senão deriva do label.
  return rows.map((r) => ({ ...r, orgao_npi: r.orgao_npi ?? orgaoDoLabel(String(r.orgao_label)) }));
}

/** Código, descrição e nível de um NCM (descrição vem de NCMOccurrence). */
/** Um degrau da árvore NCM: capítulo, posição, subposição, item... */
export interface NivelNcm {
  codigo: string;
  nivel: string;
  descricao: string;
}

/**
 * Descrição HIERÁRQUICA do NCM.
 *
 * A descrição de um item folha isolada é inútil para quem opera: 2933.39.99 é
 * literalmente "Outros". O sentido está na cadeia — capítulo, posição,
 * subposição — e é ela que sustenta a classificação perante a fiscalização.
 *
 * `code_canonical` é só dígitos no grafo (29, 2933, 29333, 293339, ...), então
 * todo ancestral é um PREFIXO do código do item. Uma comparação por prefixo
 * devolve a cadeia inteira sem precisar percorrer relações.
 */
export async function getNcmHierarquia(code: string): Promise<NivelNcm[]> {
  const canon = String(code).replace(/\D/g, '');
  if (!canon) return [];
  const rows = await query(
    `MATCH (o:NCMOccurrence)
      WHERE size(o.code_canonical) <= size($canon) AND $canon STARTS WITH o.code_canonical
      RETURN coalesce(o.code_display, o.code_canonical) AS codigo,
             o.level_code        AS nivel,
             o.description_plain AS descricao
      ORDER BY size(o.code_canonical)`,
    { canon },
  );
  return rows
    .map((r) => ({
      codigo: String(r.codigo ?? ''),
      nivel: String(r.nivel ?? ''),
      descricao: String(r.descricao ?? '').trim(),
    }))
    .filter((r) => r.descricao);
}

/**
 * Junta a cadeia numa linha única.
 *
 * Remove só os travessões de indentação que a TIPI usa para marcar
 * profundidade ("-- Outros"); o resto do texto oficial fica intacto, inclusive
 * a pontuação final, porque é a redação que vale numa contestação.
 */
export function descricaoCompleta(niveis: NivelNcm[]): string {
  return niveis.map((n) => n.descricao.replace(/^[-\s]+/, '').trim()).filter(Boolean).join(' - ');
}

export async function getNcmInfo(code: string) {
  const cypher = `
    MATCH (n:NCMCode {id: $id})
    OPTIONAL MATCH (o:NCMOccurrence {code_canonical: n.code_canonical})
    RETURN n.id AS id,
           coalesce(o.code_display, n.code_canonical) AS codigo,
           o.description_plain                        AS descricao,
           o.level_code                               AS nivel,
           o.is_leaf                                  AS folha
    LIMIT 1`;
  const [rows, hierarquia] = await Promise.all([
    query(cypher, { id: ncmId(code) }),
    getNcmHierarquia(code),
  ]);
  const base = rows[0];
  if (!base && hierarquia.length === 0) return null;
  // A hierarquia sozinha já identifica o NCM mesmo quando não há nó NCMCode.
  const folha = hierarquia[hierarquia.length - 1];
  return {
    ...(base ?? { id: null, codigo: folha?.codigo ?? code, descricao: folha?.descricao ?? null,
                  nivel: folha?.nivel ?? null, folha: true }),
    hierarquia,
    descricao_completa: descricaoCompleta(hierarquia) || null,
  };
}

/** Snapshot do banco por label (debug/health). */
export function getStats() {
  return query(`MATCH (n) RETURN labels(n)[0] AS label, count(n) AS total ORDER BY total DESC LIMIT 25`);
}

/** Órgãos anuentes com regras NCM ativas. */
export async function getOrgaosAtivos() {
  const rows = await query(`
    MATCH (rule)-[:APLICA_SOBRE]->(:NCMCode)
    RETURN labels(rule)[0] AS orgao_label, count(*) AS total_ncm
    ORDER BY total_ncm DESC`);
  return rows.map((r) => ({ ...r, orgao: orgaoDoLabel(String(r.orgao_label)) }));
}
