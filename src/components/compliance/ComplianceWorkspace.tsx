/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de Conformidade Aduaneira sobre o SAT-Graph (Neo4j).
 * Consulta /api/sat-graph/ncm/:code e mostra os órgãos anuentes + TAs/LPCO que
 * incidem sobre o NCM, direto do grafo de produção (somente leitura).
 *
 * Integrações (ver docs/analise/conformidade-estado-atual.md):
 *  - EvidenceContext: alimenta a trilha auditável do painel direito (P1)
 *  - /api/norma: base legal clicável, mesmo padrão do AuditWorkspace (P3)
 *  - ProcessContext: preserva a consulta ao trocar de agente (P5)
 *  - LiMinutaModal: ação de saída nos TAs que exigem anuência (P4)
 */
import React, { useState } from 'react';
import {
  AlertTriangle, ChevronDown, FileSignature, Loader2, Network, Printer,
  Save, Search, ShieldAlert, ShieldCheck, X,
} from 'lucide-react';
import { useEvidence } from '../../context/EvidenceContext';
import { useProcessos } from '../../context/ProcessContext';
import LiMinutaModal from '../LiMinutaModal';
import type { LiPrefillData } from '../../types';

/** Uma regra de tratamento administrativo, já normalizada pelo backend. */
export interface Tratamento {
  orgao_label?: string | null;
  orgao_npi?: string | null;
  orgao_nome?: string | null;
  ta_id?: string | null;
  modelo?: string | null;
  nome_modelo?: string | null;
  tipo_ta?: string | null;
  impede_desembaraco?: string | null;
  prazo?: string | null;
  base_legal?: string | null;
  vigencia?: string | null;
  duimp?: string | null;
  inspecao?: string | null;
  escopo?: string | null;
  rule_id?: string | null;
}

interface NivelNcm {
  codigo: string;
  nivel: string;
  descricao: string;
}

interface NcmInfo {
  codigo?: string;
  descricao?: string;
  nivel?: string;
  folha?: boolean;
  /** Cadeia capítulo -> posição -> ... -> item, do grafo. */
  hierarquia?: NivelNcm[];
  /** A cadeia junta numa linha: é a descrição que identifica a mercadoria. */
  descricao_completa?: string;
}

const NIVEL_LABEL: Record<string, string> = {
  CHAPTER: 'Capítulo', POSITION: 'Posição', SUBPOSITION: 'Subposição',
  INTERMEDIATE: 'Desdobramento', ITEM: 'Item',
};

interface Resultado {
  ncm: NcmInfo;
  tratamentos: Tratamento[];
  total_orgaos: number;
}

interface NormaData {
  identificacao: string;
  tipo?: string;
  orgao_emissor?: string;
  ementa?: string;
}

/* ---------- helpers de apresentação ---------- */

/** Texto não vazio, senão null — evita badges/chips vazios (P7). */
const val = (v?: string | null): string | null => {
  const s = (v ?? '').toString().trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
};

const impedeDesembaraco = (t: Tratamento): boolean =>
  (t.impede_desembaraco ?? '').toString().trim().toLowerCase().startsWith('s');

/** Órgãos cuja anuência costuma exigir Licença de Importação. */
const EXIGE_LI = ['ANVISA', 'MCT', 'MCTI', 'MAPA', 'IBAMA', 'DFPC', 'DPF', 'CNEN', 'ANP'];
const exigeLicenca = (t: Tratamento): boolean => {
  const orgao = (t.orgao_npi ?? t.orgao_label ?? '').toString().toUpperCase();
  return EXIGE_LI.some((o) => orgao.includes(o)) || !!val(t.modelo);
};

/**
 * Extrai a 1ª norma citável do texto de base legal (mesmo padrão do AuditWorkspace).
 * O grafo traz dois formatos: com barra ("Lei 9782/99", "RDC 752/2022") e por
 * extenso ("Lei n° 9.112, de 10 de outubro de 1995"). Cobrimos ambos.
 */
export function extractRef(baseLegal?: string | null): string | null {
  if (!baseLegal) return null;

  // Formato 1 — número/ano: "Lei 9782/99", "RDC 752/2022", "Portaria Secex nº 23/2011"
  const barra = baseLegal.match(
    /(RDC|LC|IN RFB|IN|Decreto[- ]Lei|Decreto|Lei|Portaria Secex|Portaria|Resolução Gecex|Resolução)\s*n?[º°]?\s*([\d.]+\/\d{2,4})/i,
  );
  if (barra) return `${barra[1]} ${barra[2]}`.replace(/\s+/g, ' ');

  // Formato 2 — por extenso: "Lei n° 9.112, de 10 de outubro de 1995" → "Lei 9.112/1995"
  const extenso = baseLegal.match(
    /(RDC|LC|IN RFB|IN|Decreto[- ]Lei|Decreto|Lei|Portaria|Resolução)\s*n?[º°]?\s*([\d.]+)\s*,?\s*de\s+[^,]{0,40}?(\d{4})/i,
  );
  if (extenso) return `${extenso[1]} ${extenso[2]}/${extenso[3]}`.replace(/\s+/g, ' ');

  return null;
}

export default function ComplianceWorkspace({ onClose }: { onClose: () => void }) {
  const [ncm, setNcm] = useState('2933.39.99');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [norma, setNorma] = useState<Record<string, NormaData | 'loading' | 'erro'>>({});
  const [liPrefill, setLiPrefill] = useState<LiPrefillData | null>(null);
  const [salvo, setSalvo] = useState(false);

  const { setEvidence } = useEvidence();
  const [verHierarquia, setVerHierarquia] = useState(false);
  const { conformidade, setConformidade } = useProcessos();

  // A consulta vive no ProcessContext: trocar de agente no Dock não a descarta (P5).
  const data: Resultado | null = conformidade
    ? { ncm: conformidade.ncm, tratamentos: conformidade.tratamentos as Tratamento[], total_orgaos: conformidade.total_orgaos }
    : null;

  /** Alimenta o Painel de Evidências com a trilha auditável da consulta (P1). */
  const publicarEvidencia = (r: Resultado, codigo: string) => {
    const porOrgao = new Map<string, Tratamento[]>();
    r.tratamentos.forEach((t) => {
      const k = val(t.orgao_npi) ?? val(t.orgao_label) ?? 'Outro';
      porOrgao.set(k, [...(porOrgao.get(k) ?? []), t]);
    });

    const bloqueios = r.tratamentos.filter(impedeDesembaraco).length;
    const semBaseLegal = r.tratamentos.filter((t) => !val(t.base_legal)).length;

    const steps = [
      `Resolvi o NCM ${codigo} no grafo normativo (SAT-Graph) e localizei ${r.tratamentos.length} regra(s) de tratamento administrativo.`,
      ...(val(r.ncm.descricao_completa)
        ? [`Descrição hierárquica (${r.ncm.hierarquia?.length ?? 0} níveis): ${val(r.ncm.descricao_completa)}`]
        : []),
      `Cruzei as regras com ${r.total_orgaos} órgão(s) anuente(s): ${[...porOrgao.keys()].join(', ')}.`,
      ...[...porOrgao.entries()].map(([orgao, ts]) => {
        const vig = val(ts[0]?.vigencia);
        const base = val(ts[0]?.base_legal);
        return `${orgao}: ${ts.length} tratamento(s)${base ? ` — base ${base}` : ''}${vig ? ` · vigência ${vig}` : ''}.`;
      }),
      bloqueios > 0
        ? `⚠️ ${bloqueios} regra(s) marcada(s) como IMPEDE DESEMBARAÇO — exigem LPCO deferido antes do registro.`
        : 'Nenhuma regra sinalizou impedimento de desembaraço neste NCM.',
      // Guardrail honesto: o grafo é um snapshot do NPI, não a fonte operacional.
      semBaseLegal > 0
        ? `Cobertura da trilha: ${r.tratamentos.length - semBaseLegal}/${r.tratamentos.length} regra(s) com base legal explícita no grafo. Confirme a incidência no Simulador do Portal Único.`
        : 'Todas as regras retornaram base legal explícita. Confirme a incidência no Simulador do Portal Único.',
    ];

    // Citações: normas efetivamente presentes na resposta (sem inventar).
    const refs = new Map<string, string>();
    r.tratamentos.forEach((t) => {
      const ref = extractRef(t.base_legal);
      if (ref && !refs.has(ref)) {
        refs.set(ref, `${val(t.orgao_npi) ?? 'Órgão'} · ${val(t.base_legal) ?? ''}`.trim());
      }
    });

    setEvidence({
      agent: 'compliance',
      titulo: `Conformidade · NCM ${codigo}`,
      steps,
      citations: [...refs.entries()].map(([ref, nota]) => ({ ref, nota })),
    });
  };

  const consultar = async () => {
    const code = ncm.replace(/\D/g, '');
    if (!code) return;
    setLoading(true);
    setErro(null);
    setConformidade(null);
    setSalvo(false);
    try {
      const resp = await fetch(`/api/sat-graph/ncm/${code}`);
      const d = await resp.json();
      if (d.success) {
        const r: Resultado = { ncm: d.ncm, tratamentos: d.tratamentos ?? [], total_orgaos: d.total_orgaos ?? 0 };
        setConformidade({
          ncm: r.ncm,
          tratamentos: r.tratamentos as unknown as Record<string, unknown>[],
          total_orgaos: r.total_orgaos,
          consultadoEm: new Date().toISOString(),
        });
        setAberto(null);
        publicarEvidencia(r, val(r.ncm.codigo) ?? code);
      } else {
        setErro(d.error || 'Consulta indisponível.');
      }
    } catch {
      setErro('Falha ao contatar o SAT-Graph. Rode o servidor (npm run dev) com NEO4J_* no .env.');
    } finally {
      setLoading(false);
    }
  };

  /** Base legal clicável — mesmo padrão do AuditWorkspace (P3). */
  const carregarNorma = async (ref: string) => {
    if (norma[ref] && norma[ref] !== 'erro') return;
    setNorma((n) => ({ ...n, [ref]: 'loading' }));
    try {
      const r = await fetch(`/api/norma?ref=${encodeURIComponent(ref)}`);
      const d = r.ok ? await r.json() : { success: false };
      setNorma((n) => ({ ...n, [ref]: d.success ? d.norma : 'erro' }));
    } catch {
      setNorma((n) => ({ ...n, [ref]: 'erro' }));
    }
  };

  /** Abre a minuta de LI pré-preenchida com o contexto da consulta (P4). */
  const gerarMinuta = (t: Tratamento) => {
    const codigo = val(data?.ncm.codigo) ?? ncm;
    setLiPrefill({
      ncm: codigo,
      // A minuta precisa da descrição que IDENTIFICA a mercadoria, não do
      // "Outros" da folha — é ela que a autoridade lê no LPCO.
      description: val(data?.ncm.descricao_completa) ?? val(data?.ncm.descricao)
        ?? val(t.tipo_ta) ?? 'Mercadoria importada',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      origin: '—',
      legalRule: val(t.base_legal) ?? `${val(t.orgao_npi) ?? 'Órgão anuente'} — tratamento ${val(t.ta_id) ?? 'administrativo'}`,
      exporter: '',
      manufacturer: '',
    });
  };

  const salvarNoProcesso = () => {
    if (!data) return;
    setSalvo(true); // já persistido no ProcessContext pela consulta
  };

  // Agrupa por órgão, com os que impedem desembaraço primeiro (P6).
  const grupos: [string, Tratamento[]][] = React.useMemo(() => {
    const m = new Map<string, Tratamento[]>();
    (data?.tratamentos ?? []).forEach((t) => {
      const k = val(t.orgao_npi) ?? val(t.orgao_label) ?? 'Outro';
      m.set(k, [...(m.get(k) ?? []), t]);
    });
    return [...m.entries()].sort((a, b) => {
      const ba = a[1].some(impedeDesembaraco) ? 0 : 1;
      const bb = b[1].some(impedeDesembaraco) ? 0 : 1;
      return ba - bb || b[1].length - a[1].length;
    });
  }, [data]);

  const totalBloqueios = (data?.tratamentos ?? []).filter(impedeDesembaraco).length;

  return (
    <section className="h-full flex-1 overflow-y-auto bg-slate-100/60" id="compliance-workspace">
      <div className="mx-auto max-w-4xl px-6 py-6">
        {/* Cabeçalho */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Motor de Conformidade · SAT-Graph</h2>
              <p className="text-sm text-slate-400">Órgãos anuentes e tratamentos administrativos (TA/LPCO) por NCM — grafo Neo4j</p>
            </div>
          </div>
          <button onClick={onClose} title="Fechar" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2">
          <Search className="ml-1 h-4 w-4 shrink-0 text-teal-500" />
          <input
            value={ncm}
            onChange={(e) => setNcm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') consultar(); }}
            placeholder="NCM (ex.: 2933.39.99 · 6 órgãos; 3304.99.90 · cosmético ANVISA)"
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 font-mono text-sm text-slate-800 outline-none placeholder:font-sans placeholder:text-slate-400"
          />
          <button onClick={consultar} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Consultar
          </button>
        </div>

        {/* NCMs de exemplo — clicáveis */}
        {!data && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>Exemplos:</span>
            {[
              { c: '2933.39.99', d: '6 órgãos' },
              { c: '3304.99.90', d: 'cosmético · ANVISA' },
              { c: '8479.89.99', d: '24 regras' },
            ].map((ex) => (
              <button
                key={ex.c}
                onClick={() => { setNcm(ex.c); }}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
              >
                {ex.c} <span className="font-sans text-slate-400">· {ex.d}</span>
              </button>
            ))}
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Resumo + ações de saída (P4) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[260px] flex-1">
                  <span className="block font-mono text-sm font-semibold text-slate-900">{val(data.ncm.codigo) ?? ncm}</span>
                  {/* A descrição da folha isolada não identifica nada: 2933.39.99 é
                      literalmente "Outros". O que identifica é a cadeia inteira. */}
                  <p className="text-xs leading-relaxed text-slate-600">
                    {val(data.ncm.descricao_completa) ?? val(data.ncm.descricao) ?? '—'}
                  </p>
                  {(data.ncm.hierarquia?.length ?? 0) > 1 && (
                    <button
                      onClick={() => setVerHierarquia((v) => !v)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 transition-colors duration-150 hover:text-teal-900"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${verHierarquia ? 'rotate-180' : ''}`} />
                      {verHierarquia ? 'ocultar' : 'ver'} os {data.ncm.hierarquia!.length} níveis da NCM
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {totalBloqueios > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      <ShieldAlert className="h-3.5 w-3.5" /> {totalBloqueios} impedimento(s)
                    </span>
                  )}
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                    {data.total_orgaos} órgão(s) · {data.tratamentos.length} TA(s)
                  </span>
                </div>
              </div>

              {verHierarquia && data.ncm.hierarquia && (
                <ol className="mt-3 border-t border-slate-100 pt-3">
                  {data.ncm.hierarquia.map((n, i) => (
                    <li key={n.codigo} className="flex gap-2 py-1 text-xs" style={{ paddingLeft: i * 12 }}>
                      <span className="w-24 shrink-0 font-mono text-[11px] text-slate-400">{n.codigo}</span>
                      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-slate-300">
                        {NIVEL_LABEL[n.nivel] ?? n.nivel}
                      </span>
                      <span className="min-w-0 text-slate-600">{n.descricao.replace(/^[-\s]+/, '')}</span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={salvarNoProcesso}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                >
                  <Save className="h-3.5 w-3.5" /> {salvo ? 'Salvo no processo ativo' : 'Salvar no processo ativo'}
                </button>
                <button
                  onClick={() => window.print()}
                  title="Gera o PDF pela caixa de impressão do navegador"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                >
                  <Printer className="h-3.5 w-3.5" /> Exportar relatório (PDF)
                </button>
              </div>
            </div>

            {/* Tratamentos por órgão — accordion (P2) */}
            {data.tratamentos.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                <ShieldCheck className="mx-auto mb-1 h-8 w-8 stroke-1 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-700">Sem tratamento administrativo mapeado</p>
                <p className="text-xs text-slate-400">Nenhuma regra incide sobre este NCM no grafo. Confirme sempre no Simulador do Portal Único.</p>
              </div>
            ) : (
              grupos.map(([orgao, tas]) => {
                const bloqueia = tas.some(impedeDesembaraco);
                return (
                  <div key={orgao} className={`overflow-hidden rounded-xl border bg-white ${bloqueia ? 'border-rose-200' : 'border-slate-200'}`}>
                    <div className={`flex items-center justify-between border-b px-4 py-2.5 ${bloqueia ? 'border-rose-100 bg-rose-50/60' : 'border-slate-100 bg-slate-50/70'}`}>
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {bloqueia && <ShieldAlert className="h-4 w-4 text-rose-600" />}
                        {orgao}
                      </h3>
                      <span className="font-mono text-[10px] text-slate-400">{tas.length} regra(s)</span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {tas.map((t, i) => {
                        const chave = `${orgao}-${i}`;
                        const isOpen = aberto === chave;
                        const bloqueiaEste = impedeDesembaraco(t);
                        const ref = extractRef(t.base_legal);
                        const nd = ref ? norma[ref] : undefined;
                        const titulo = val(t.tipo_ta) ?? val(t.nome_modelo) ?? 'Tratamento administrativo';

                        return (
                          <div key={chave}>
                            <button
                              onClick={() => setAberto(isOpen ? null : chave)}
                              className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                              {val(t.ta_id) && (
                                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">{val(t.ta_id)}</span>
                              )}
                              <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{titulo}</span>
                              {bloqueiaEste && (
                                <span className="shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                  impede desembaraço
                                </span>
                              )}
                              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isOpen && (
                              <div className="space-y-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3 text-[11px] leading-relaxed">
                                <div className="flex flex-wrap gap-x-5 gap-y-1 text-slate-500">
                                  {val(t.modelo) && <span>Modelo LPCO: <span className="font-mono text-slate-700">{val(t.modelo)}</span></span>}
                                  {val(t.prazo) && <span>Prazo: {val(t.prazo)}</span>}
                                  {val(t.vigencia) && <span>Vigência: {val(t.vigencia)}</span>}
                                  {val(t.duimp) && <span>DUIMP: {val(t.duimp)}</span>}
                                  {val(t.inspecao) && <span>Inspeção: {val(t.inspecao)}</span>}
                                </div>

                                {/* Base legal clicável (P3) */}
                                {val(t.base_legal) && (
                                  <div>
                                    <span className="font-semibold text-slate-500">Base legal: </span>
                                    {ref ? (
                                      <button
                                        onClick={() => carregarNorma(ref)}
                                        className="font-mono text-teal-700 underline decoration-dotted underline-offset-2 hover:text-teal-900"
                                      >
                                        {ref}
                                      </button>
                                    ) : (
                                      <span className="text-slate-600">{val(t.base_legal)}</span>
                                    )}
                                    {nd === 'loading' && <span className="ml-1 inline-flex items-center gap-1 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> …</span>}
                                    {nd === 'erro' && <span className="ml-1 text-amber-600">(texto não disponível na base)</span>}
                                    {nd && typeof nd === 'object' && (
                                      <div className="mt-1 rounded-lg bg-white p-2 text-slate-600 ring-1 ring-slate-200">
                                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{nd.tipo} · {nd.orgao_emissor}</span>
                                        {nd.ementa}
                                      </div>
                                    )}
                                    {ref && <p className="mt-0.5 text-slate-400">{val(t.base_legal)}</p>}
                                  </div>
                                )}

                                {/* Ação de saída (P4) */}
                                {exigeLicenca(t) && (
                                  <button
                                    onClick={() => gerarMinuta(t)}
                                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-teal-500"
                                  >
                                    <FileSignature className="h-3.5 w-3.5" /> Gerar Minuta de LI
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            <p className="text-[10px] leading-relaxed text-slate-400">
              Fonte: SAT-Graph (Neo4j, snapshot NPI). Informativo — a incidência efetiva deve ser confirmada no Simulador de TA do Portal Único.
            </p>
          </div>
        )}
      </div>

      {liPrefill && <LiMinutaModal data={liPrefill} onClose={() => setLiPrefill(null)} />}
    </section>
  );
}
