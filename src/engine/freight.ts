/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de cotação de frete marítimo — função PURA, sem I/O.
 *
 * Recebe uma cotação desagrupada da rate sheet e os dados da carga; devolve a
 * tarifa efetivamente aplicável, as taxas incidentes e o total. É o mesmo motor
 * para os dois backends (JSON embarcado e Postgres), então o número mostrado na
 * tela e o número gravado no processo não podem divergir.
 *
 * Testes: npm run test:freight
 */

export type Equipamento = '20GP' | '40GP' | '40HQ' | '40NOR' | '40RF' | 'LCL';
export type BasePeso = 'VGM' | 'CARGO' | 'NAO_ESPECIFICADO';
export type StatusValidade = 'vigente' | 'expirando' | 'expirado' | 'sem_validade';

export interface Surcharge {
  fee_code: string;
  fee_label: string | null;
  amount: number;
  currency: string;
  charge_basis: string;
  equipment_type: string | null;
  /** OWS é escalonado: USD 200 acima de 14 t, USD 500 acima de 20 t. */
  min_weight_ton: number | null;
  condition_raw: string | null;
  source_column: string | null;
}

/** Uma linha de `v_freight_quotes` — o grão (rota × equipamento). */
export interface FreightQuote {
  quote_id: number;
  route_id: number;
  carrier: string;
  carrier_scope: string[];
  trade_lane: string;
  pol: string;
  pol_name: string;
  /** Coordenadas reais do porto — posicionam o Radar de Mercado. */
  pol_lat: number | null;
  pol_lon: number | null;
  pod: string;
  pod_name: string;
  pod_country: string;
  pod_lat: number | null;
  pod_lon: number | null;
  service_type: string;
  service_name: string | null;
  validity_start: string | null;
  validity_end: string | null;
  validity_raw: string | null;
  vessel_ref: string | null;
  space_status: string | null;
  equipment_type: Equipamento;
  also_valid_for: Equipamento[];
  base_rate: number;
  adjusted_rate: number | null;
  weight_operator: '<' | '<=' | '>' | '>=' | null;
  weight_limit_ton: number | null;
  weight_basis: BasePeso | null;
  cargo_type: string | null;
  unit: 'CONTAINER' | 'CBM';
  currency: string;
  free_days_pol: number | null;
  free_days_pod: number | null;
  surcharges: Surcharge[];
  source_sheet: string;
  source_row: number;
  /**
   * Ressalvas que o ETL registrou para a LINHA de origem desta cotação. Sem
   * isto a trilha de qualidade morre no banco: a tarifa de USD 1.015 de
   * Chongqing (dígito faltando na planilha) chegaria à tela como oferta real.
   */
  data_issues?: { kind: string; severity: string; detail: string }[];
}

export interface ParamsCotacao {
  /** Peso da carga em toneladas. Se ausente, tarifas condicionais não se aplicam. */
  pesoTon?: number;
  /** O peso informado é da MERCADORIA ou já é o VGM (com tara)? */
  pesoInformadoComo?: 'CARGO' | 'VGM';
  /** Volume em m³ — só para LCL. */
  cbm?: number;
  /** Data de referência para vigência (ISO). Default: hoje. */
  hoje?: string;
}

export interface LinhaCusto {
  rotulo: string;
  valorUsd: number;
  detalhe?: string;
}

export interface Cotacao {
  quote: FreightQuote;
  /** Tarifa que realmente se aplica (base, ou a condicional quando o peso a libera). */
  tarifaAplicada: number;
  tarifaBase: number;
  /** Economia obtida pela faixa de peso, em USD. */
  descontoPeso: number;
  linhas: LinhaCusto[];
  totalUsd: number;
  status: StatusValidade;
  diasParaVencer: number | null;
  /** Ressalvas que o operador precisa ver ANTES de fechar. */
  alertas: string[];
}

/**
 * Tara média do contêiner, em toneladas.
 *
 * Existe porque VGM (Verified Gross Mass, SOLAS) = carga + tara. Uma regra
 * "9400 se <= 16 ton VGM" comparada contra o peso da MERCADORIA concede um
 * desconto que o armador glosa na fatura: 15 t de carga num 40'HQ são ~18,9 t
 * de VGM, acima do limite.
 */
const TARA_TON: Record<Equipamento, number> = {
  '20GP': 2.2, '40GP': 3.75, '40HQ': 3.9, '40NOR': 3.8, '40RF': 4.6, LCL: 0,
};

/** Converte o peso informado para a base que a regra da tarifa exige. */
export function pesoNaBase(
  pesoTon: number,
  informadoComo: 'CARGO' | 'VGM',
  baseRegra: BasePeso,
  equipamento: Equipamento,
): { peso: number; convertido: boolean } {
  if (baseRegra === 'VGM' && informadoComo === 'CARGO') {
    return { peso: pesoTon + (TARA_TON[equipamento] ?? 0), convertido: true };
  }
  if (baseRegra === 'CARGO' && informadoComo === 'VGM') {
    return { peso: Math.max(0, pesoTon - (TARA_TON[equipamento] ?? 0)), convertido: true };
  }
  return { peso: pesoTon, convertido: false };
}

function satisfaz(peso: number, op: string, limite: number): boolean {
  switch (op) {
    case '<': return peso < limite;
    case '<=': return peso <= limite;
    case '>': return peso > limite;
    case '>=': return peso >= limite;
    default: return false;
  }
}

function statusDe(fim: string | null, hoje: string): { status: StatusValidade; dias: number | null } {
  if (!fim) return { status: 'sem_validade', dias: null };
  const ms = Date.parse(`${fim}T23:59:59Z`) - Date.parse(`${hoje}T00:00:00Z`);
  const dias = Math.floor(ms / 86_400_000);
  if (dias < 0) return { status: 'expirado', dias };
  if (dias <= 3) return { status: 'expirando', dias };
  return { status: 'vigente', dias };
}

/**
 * Aplica a carga sobre uma cotação e devolve o custo composto.
 *
 * Ordem: tarifa base -> faixa de peso -> taxas fixas -> taxas por excesso de peso.
 */
export function cotar(q: FreightQuote, p: ParamsCotacao = {}): Cotacao {
  const hoje = p.hoje ?? new Date().toISOString().slice(0, 10);
  const informadoComo = p.pesoInformadoComo ?? 'CARGO';
  const alertas: string[] = [];

  // ---- 1. Tarifa: base ou faixa de peso -----------------------------------
  let tarifa = q.base_rate;
  let desconto = 0;
  if (q.adjusted_rate != null && q.weight_operator && q.weight_limit_ton != null) {
    const base = q.weight_basis ?? 'NAO_ESPECIFICADO';
    if (p.pesoTon == null) {
      alertas.push(
        `Há tarifa de ${q.currency} ${q.adjusted_rate.toLocaleString('pt-BR')} para carga ` +
        `${q.weight_operator} ${q.weight_limit_ton} t. Informe o peso para aplicá-la.`,
      );
    } else {
      const { peso, convertido } = pesoNaBase(p.pesoTon, informadoComo, base, q.equipment_type);
      if (satisfaz(peso, q.weight_operator, q.weight_limit_ton)) {
        desconto = q.base_rate - q.adjusted_rate;
        tarifa = q.adjusted_rate;
        if (convertido) {
          alertas.push(
            `Faixa aplicada sobre ${peso.toFixed(1)} t de VGM (${p.pesoTon} t de carga + ` +
            `${(TARA_TON[q.equipment_type] ?? 0).toFixed(1)} t de tara do ${q.equipment_type}).`,
          );
        }
      } else if (convertido && satisfaz(p.pesoTon, q.weight_operator, q.weight_limit_ton)) {
        // O caso caro: passaria pelo peso da mercadoria, mas o limite é de VGM.
        alertas.push(
          `Tarifa reduzida NÃO se aplica: a regra é ${q.weight_limit_ton} t de VGM e a carga ` +
          `de ${p.pesoTon} t vira ${peso.toFixed(1)} t com a tara do ${q.equipment_type}.`,
        );
      }
      if (base === 'NAO_ESPECIFICADO') {
        alertas.push('A planilha não diz se o limite de peso é VGM ou peso de mercadoria — confirmar com o armador.');
      }
    }
  }

  // ---- 2. Composição do custo ---------------------------------------------
  const unidade = q.unit === 'CBM' ? (p.cbm ?? 1) : 1;
  const linhas: LinhaCusto[] = [{
    rotulo: q.unit === 'CBM' ? `Frete marítimo (${q.currency} ${tarifa}/m³ × ${unidade} m³)` : 'Frete marítimo base',
    valorUsd: tarifa * unidade,
    detalhe: desconto > 0 ? `faixa de peso aplicada (−${desconto.toLocaleString('pt-BR')})` : undefined,
  }];

  for (const s of q.surcharges) {
    // Taxa amarrada a outro equipamento não incide nesta cotação.
    if (s.equipment_type && s.equipment_type !== q.equipment_type) continue;
    if (s.min_weight_ton != null) {
      if (p.pesoTon == null) {
        alertas.push(
          `${s.fee_code} de ${q.currency} ${s.amount} incide acima de ${s.min_weight_ton} t — ` +
          'informe o peso para saber se aplica.',
        );
        continue;
      }
      if (p.pesoTon <= s.min_weight_ton) continue;
    }
    linhas.push({
      rotulo: s.fee_label && s.fee_code === 'OTHER' ? s.fee_label : s.fee_code,
      valorUsd: s.amount,
      detalhe: s.min_weight_ton != null ? `acima de ${s.min_weight_ton} t` : undefined,
    });
  }

  // Faixas de excesso de peso são escalonadas, não cumulativas: entre USD 200
  // (>14 t) e USD 500 (>20 t), uma carga de 22 t paga só a de 500.
  const ows = linhas.filter((l) => l.detalhe?.startsWith('acima de'));
  if (ows.length > 1) {
    const manter = ows.reduce((a, b) => (b.valorUsd > a.valorUsd ? b : a));
    for (const l of ows) if (l !== manter) linhas.splice(linhas.indexOf(l), 1);
  }

  const { status, dias } = statusDe(q.validity_end, hoje);
  if (status === 'expirado') alertas.push(`Tarifa expirada em ${q.validity_end} — revalidar com o armador.`);
  if (status === 'sem_validade') {
    alertas.push(`Sem validade interpretável na planilha${q.validity_raw ? `: "${q.validity_raw}"` : ''}.`);
  }
  if (q.cargo_type) alertas.push(`Tarifa restrita a ${q.cargo_type.toLowerCase()} — não vale para carga geral.`);
  for (const i of q.data_issues ?? []) {
    alertas.push(`Qualidade do dado (${q.source_sheet}!L${q.source_row}): ${i.detail}`);
  }
  if (q.carrier_scope?.includes('NAC')) alertas.push('Tarifa de contrato de conta nomeada (NAC): exige elegibilidade.');

  return {
    quote: q,
    tarifaAplicada: tarifa,
    tarifaBase: q.base_rate,
    descontoPeso: desconto,
    linhas,
    totalUsd: Math.round(linhas.reduce((s, l) => s + l.valorUsd, 0) * 100) / 100,
    status,
    diasParaVencer: dias,
    alertas,
  };
}

/** Ordena por total; vigência empata o critério — tarifa expirada nunca lidera. */
export function ordenarPorCusto(cs: Cotacao[]): Cotacao[] {
  const peso: Record<StatusValidade, number> = { vigente: 0, expirando: 1, sem_validade: 2, expirado: 3 };
  return [...cs].sort((a, b) => peso[a.status] - peso[b.status] || a.totalUsd - b.totalUsd);
}
