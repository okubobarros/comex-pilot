/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Taxas locais de destino — o pedaço do custo que acontece depois do navio.
 *
 * O frete internacional cobre o trecho até o costado. THC, ISPS, DPP, drop off,
 * BL fee e as taxas do agente de carga acontecem no porto brasileiro e são
 * cobradas em duas moedas, sobre duas bases diferentes:
 *
 *   BL   — uma vez por conhecimento de embarque, não importa quantos contêineres
 *   CNTR — multiplicada pela quantidade de contêineres
 *
 * Confundir as duas é o erro que mais dói: tratar THC como taxa de BL num
 * embarque de 3 contêineres em Santos subestima o custo em ~BRL 3.200.
 *
 * ESTE ARQUIVO É O ESPELHO DE `mcat.total_freight_cost`
 * ----------------------------------------------------
 * A mesma conta existe em SQL (migrations/0005_local_charges.sql) para quem
 * consulta o banco direto, e aqui para o serviço que roda sobre a base
 * embarcada. Duas implementações da mesma regra divergem com o tempo — por
 * isso `scripts/test_freight_total.ts` confere as duas contra os MESMOS
 * números apurados à mão na planilha.
 */

export type UnidadeCobranca = 'BL' | 'CNTR';
export type MoedaTaxa = 'BRL' | 'USD' | 'EUR';
export type TipoEntidade = 'CARRIER' | 'FREIGHT_FORWARDER';

export interface LocalCharge {
  port_unlocode: string;
  port_code: string;
  port_name: string;
  entity_type: TipoEntidade;
  entity_name: string;
  fee_code: string;
  currency: MoedaTaxa;
  amount: number;
  calculation_unit: UnidadeCobranca;
  source_row?: number;
}

export interface ChargeIssue {
  port_code: string | null;
  entity_name: string;
  fee_code: string;
  severity: 'erro' | 'aviso' | 'info';
  kind: string;
  detail: string;
  source_row?: number;
}

/** Uma taxa já com o valor do embarque calculado. */
export interface LinhaTaxaLocal {
  fee_code: string;
  entity_name: string;
  entity_type: TipoEntidade;
  currency: MoedaTaxa;
  /** Valor unitário como está na tabela. */
  unitario: number;
  calculation_unit: UnidadeCobranca;
  /** Valor total desta linha no embarque (unitário x contêineres, se CNTR). */
  total: number;
}

export interface CustoLocal {
  porto: string;
  portoNome: string;
  containers: number;
  usdBrl: number;
  linhas: LinhaTaxaLocal[];
  porBlBrl: number;
  porBlUsd: number;
  porCntrBrl: number;
  porCntrUsd: number;
  /** Tudo convertido para USD pela taxa informada. */
  totalUsd: number;
  totalBrl: number;
  /** Ressalvas da fonte que se aplicam a este porto/entidade. */
  ressalvas: string[];
}

export interface ParamsCustoLocal {
  /** UN/LOCODE do porto de destino. */
  pod: string;
  /** Código canônico do armador (MSK, HPL, ONE...). */
  carrier: string;
  containers: number;
  usdBrl: number;
  /** As taxas do agente entram por padrão: são cobradas junto. */
  incluirAgente?: boolean;
  nomeAgente?: string;
}

export const AGENTE_PADRAO = 'AGENTE DE CARGA';

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Custo local de um embarque.
 *
 * Devolve `null` quando não há NENHUMA taxa cadastrada para o porto — que é
 * diferente de custo zero. Um porto sem taxa na base não significa desembaraço
 * de graça; significa que não sabemos, e quem chama precisa poder distinguir
 * as duas coisas para não exibir "R$ 0,00" como se fosse resultado.
 */
export function calcularCustoLocal(
  charges: LocalCharge[],
  issues: ChargeIssue[],
  p: ParamsCustoLocal,
): CustoLocal | null {
  const pod = p.pod.toUpperCase();
  const carrier = p.carrier.toUpperCase();
  const agente = (p.nomeAgente ?? AGENTE_PADRAO).toUpperCase();
  const incluirAgente = p.incluirAgente !== false;
  const qtd = Math.max(1, Math.floor(p.containers));

  const entidades = new Set([carrier]);
  if (incluirAgente) entidades.add(agente);

  const doPorto = charges.filter((c) => c.port_unlocode.toUpperCase() === pod);
  if (doPorto.length === 0) return null;

  const aplicaveis = doPorto.filter((c) => entidades.has(c.entity_name.toUpperCase()));
  if (aplicaveis.length === 0) return null;

  const linhas: LinhaTaxaLocal[] = aplicaveis.map((c) => ({
    fee_code: c.fee_code,
    entity_name: c.entity_name,
    entity_type: c.entity_type,
    currency: c.currency,
    unitario: c.amount,
    calculation_unit: c.calculation_unit,
    total: arred(c.calculation_unit === 'CNTR' ? c.amount * qtd : c.amount),
  }));

  const soma = (u: UnidadeCobranca, m: MoedaTaxa) =>
    arred(
      aplicaveis
        .filter((c) => c.calculation_unit === u && c.currency === m)
        .reduce((s, c) => s + c.amount, 0),
    );

  const porBlBrl = soma('BL', 'BRL');
  const porBlUsd = soma('BL', 'USD');
  const porCntrBrl = arred(soma('CNTR', 'BRL') * qtd);
  const porCntrUsd = arred(soma('CNTR', 'USD') * qtd);

  // Sem taxa de câmbio válida não há como somar as duas moedas. Melhor deixar
  // o total em USD sem a parte em BRL do que inventar uma conversão.
  const fx = p.usdBrl > 0 ? p.usdBrl : NaN;
  const brlEmUsd = Number.isFinite(fx) ? (porBlBrl + porCntrBrl) / fx : 0;

  const ressalvas = issues
    .filter(
      (i) =>
        (i.severity === 'erro' || i.severity === 'aviso') &&
        entidades.has(i.entity_name.toUpperCase()) &&
        (!i.port_code || `BR${i.port_code}`.toUpperCase() === pod),
    )
    .map((i) => i.detail);

  return {
    porto: pod,
    portoNome: doPorto[0].port_name,
    containers: qtd,
    usdBrl: p.usdBrl,
    linhas,
    porBlBrl,
    porBlUsd,
    porCntrBrl,
    porCntrUsd,
    totalUsd: arred(porBlUsd + porCntrUsd + brlEmUsd),
    totalBrl: arred((porBlUsd + porCntrUsd) * (Number.isFinite(fx) ? fx : 0) + porBlBrl + porCntrBrl),
    ressalvas: [...new Set(ressalvas)],
  };
}

/** Agrupa as linhas por entidade, que é como o operador lê a fatura. */
export function porEntidade(c: CustoLocal): { entidade: string; tipo: TipoEntidade; linhas: LinhaTaxaLocal[] }[] {
  const mapa = new Map<string, LinhaTaxaLocal[]>();
  for (const l of c.linhas) {
    mapa.set(l.entity_name, [...(mapa.get(l.entity_name) ?? []), l]);
  }
  // Armador primeiro: é quem cobra THC e BL fee, o grosso do valor.
  return [...mapa.entries()]
    .map(([entidade, linhas]) => ({ entidade, tipo: linhas[0].entity_type, linhas }))
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'CARRIER' ? -1 : 1));
}
