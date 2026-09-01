/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Travessia profunda do SAT-Graph: do NCM até os órgãos anuentes, seus
 * tratamentos administrativos (TA/LPCO) e a base legal de cada um.
 *
 * SCHEMA REAL (verificado na instância — difere do schema hipotético):
 *   (NCMCode) <-[:INCIDE_SOBRE]- (TACondicao) -[:REGIDA_POR]-> (TratamentoAdministrativo)
 *   (TratamentoAdministrativo) -[:ANUENTE]-> (OrgaoAnuente)
 *
 * Não existem as relações REQUER_TA / VINCULADO_A / FUNDAMENTADO_POR, e a base
 * legal é PROPRIEDADE do TA (`base_legal_ta`), não um nó `AtoNormativo`. Os nós
 * `Norma`/`LegalAct` existem (13 e 32) mas cobrem o Decreto 6.759 e a IN 1.600,
 * sem ligação com os TAs do Portal Único.
 *
 * Esta é a camada GENÉRICA (Portal Único/NPI: 140 TAs, 22 órgãos, 48.451
 * condições) e é complementar à camada por órgão (`*TreatmentRule`), que liga
 * ao NCM por APLICA_SOBRE. Consultamos as duas.
 */
import { query } from './neo4j.js';
import { orgaoDoLabel } from './satGraph.js';

export interface TratamentoDetalhado {
  orgao: string;
  ta_numero: string | null;
  ta_id: string | null;
  tipo_ta: string | null;
  exigencias: string[];
  base_legal: string | null;
  vigencia: string | null;
  permite_inspecao: string | null;
  fonte: 'portal_unico' | 'orgao';
  orgao_nome?: string | null;
}

export interface OrgaoAnuenteAgrupado {
  orgao: string;
  /** Nome por extenso quando o grafo o fornece (ex.: "Agência Nacional de Vigilância Sanitária"). */
  orgao_nome: string | null;
  tratamentos: TratamentoDetalhado[];
  bases_legais: string[];
  exige_lpco: boolean;
}

/**
 * Sigla canônica para agrupar as duas camadas do grafo. Sem isto o IBAMA
 * aparece duas vezes: "IBAMA" (camada por órgão) e "Instituto Brasileiro do
 * Meio Ambiente..." (Portal Único).
 */
function siglaCanonica(valor: string): string {
  const v = valor.trim();
  // "DFPC (Exército)" → DFPC · "MCTI/CIBES" → MCTI · "ANM (ex-DNPM)" → ANM
  const primeiro = v.split(/[/(]/)[0].trim();
  return /^[A-ZÀ-Ú.]{2,12}$/.test(primeiro) ? primeiro.toUpperCase() : v;
}

const ncmId = (code: string) => `NCM_CODE_${String(code).replace(/\D/g, '')}`;
const txt = (v: unknown): string | null => {
  const s = (v ?? '').toString().trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
};

/**
 * Camada Portal Único (NPI): TA → órgão + base legal, com as condições que
 * descrevem a exigência.
 */
async function tasPortalUnico(code: string): Promise<TratamentoDetalhado[]> {
  const cypher = `
    MATCH (n:NCMCode {id: $id})<-[:INCIDE_SOBRE]-(c:TACondicao)-[:REGIDA_POR]->(ta:TratamentoAdministrativo)
    OPTIONAL MATCH (ta)-[:ANUENTE]->(org:OrgaoAnuente)
    WITH ta, org, collect(DISTINCT c.descricao_campo) AS exigencias
    RETURN coalesce(org.sigla, ta.orgao_anuente, org.id) AS orgao,
           org.nome                AS orgao_nome,
           ta.numero_ta            AS ta_numero,
           ta.ta_id                AS ta_id,
           ta.tipo_ta              AS tipo_ta,
           ta.base_legal_ta        AS base_legal,
           ta.inicio_vigencia_ta   AS vigencia,
           ta.permite_inspecao     AS permite_inspecao,
           exigencias
    ORDER BY orgao, ta_numero`;
  const rows = await query(cypher, { id: ncmId(code) });
  return rows.map((r) => ({
    orgao: siglaCanonica(txt(r.orgao) ?? 'Órgão não identificado'),
    orgao_nome: txt(r.orgao_nome),
    ta_numero: txt(r.ta_numero),
    ta_id: txt(r.ta_id),
    tipo_ta: txt(r.tipo_ta),
    exigencias: ((r.exigencias as unknown[]) ?? []).map((e) => txt(e)).filter((e): e is string => !!e).slice(0, 3),
    base_legal: txt(r.base_legal),
    vigencia: txt(r.vigencia),
    permite_inspecao: txt(r.permite_inspecao),
    fonte: 'portal_unico' as const,
  }));
}

/** Camada por órgão (`*TreatmentRule` → APLICA_SOBRE), com schema próprio. */
async function tasPorOrgao(code: string): Promise<TratamentoDetalhado[]> {
  const cypher = `
    MATCH (rule)-[:APLICA_SOBRE]->(n:NCMCode {id: $id})
    RETURN labels(rule)[0] AS label,
           coalesce(rule.orgao_anuente, rule.orgao)                           AS orgao,
           coalesce(rule.ta_id, rule.codigo_ta)                               AS ta_numero,
           coalesce(rule.tipo_ta, rule.categoria_regulatoria, rule.descricao) AS tipo_ta,
           coalesce(rule.base_legal_ta, rule.fundamentacao_legal)             AS base_legal,
           coalesce(rule.inicio_vigencia_ta, rule.data_inicio_vigencia)       AS vigencia,
           rule.impede_desembaraco AS impede
    ORDER BY label`;
  const rows = await query(cypher, { id: ncmId(code) });
  return rows.map((r) => ({
    orgao: siglaCanonica(txt(r.orgao) ?? orgaoDoLabel(String(r.label ?? ''))),
    orgao_nome: null,
    ta_numero: txt(r.ta_numero),
    ta_id: null,
    tipo_ta: txt(r.tipo_ta),
    exigencias: [],
    base_legal: txt(r.base_legal),
    vigencia: txt(r.vigencia),
    permite_inspecao: txt(r.impede) ? `impede desembaraço: ${txt(r.impede)}` : null,
    fonte: 'orgao' as const,
  }));
}

/** Conformidade completa de um NCM, agrupada por órgão anuente. */
export async function conformidadeCompleta(code: string): Promise<OrgaoAnuenteAgrupado[]> {
  const [pu, orgao] = await Promise.all([tasPortalUnico(code), tasPorOrgao(code)]);
  const todos = [...pu, ...orgao];

  const mapa = new Map<string, TratamentoDetalhado[]>();
  todos.forEach((t) => mapa.set(t.orgao, [...(mapa.get(t.orgao) ?? []), t]));

  return [...mapa.entries()]
    .map(([sigla, tratamentos]) => ({
      orgao: sigla,
      orgao_nome: tratamentos.map((t) => t.orgao_nome).find((n): n is string => !!n) ?? null,
      tratamentos,
      bases_legais: [...new Set(tratamentos.map((t) => t.base_legal).filter((b): b is string => !!b))],
      exige_lpco: tratamentos.some((t) => (t.tipo_ta ?? '').toLowerCase().includes('lpco')),
    }))
    .sort((a, b) => Number(b.exige_lpco) - Number(a.exige_lpco) || b.tratamentos.length - a.tratamentos.length);
}
