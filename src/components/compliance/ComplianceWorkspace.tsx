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
  Info, Save, Search, ShieldAlert, ShieldCheck, X,
} from 'lucide-react';
import { extractRef, extractRefs } from '../../engine/citacoes';
import { complementaresPara } from '../../engine/normasComplementares';
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

/**
 * Só oferece minuta de LI quando o tratamento REALMENTE exige licença.
 *
 * Antes bastava o órgão estar numa lista fixa ('ANVISA', 'IBAMA', ...) para o
 * botão aparecer. Isso oferecia licença onde ela não existe — o caso que expôs
 * o erro foi o dos pneus: o TA do IBAMA para NCM 4011 é do tipo "Alerta", e o
 * art. 25 da IN IBAMA 9/2021 EXTINGUIU a anuência prévia no Siscomex para LI de
 * pneus novos. Num produto de conformidade, inventar uma exigência é tão grave
 * quanto esconder uma: leva o despachante a pedir licença inexistente.
 *
 * O grafo só tem três tipos de TA — "Requer LPCO" (111), "Impede registro" (16)
 * e "Alerta" (13) — e é o tipo, não o órgão, que responde a pergunta.
 */
const exigeLicenca = (t: Tratamento): boolean => {
  const tipo = (val(t.tipo_ta) ?? '').toLowerCase();
  if (tipo.includes('lpco')) return true;
  if (tipo.includes('alerta') || tipo.includes('impede')) return false;
  // Sem tipo declarado, só um modelo de LPCO explícito sustenta a minuta.
  return !!val(t.modelo);
};


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
  const { conformidade, setConformidade, registrarProcesso } = useProcessos();

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
      // Um órgão por linha, dizendo o que ELE exige. Antes a trilha somava
      // tudo num "N regras exigem LPCO", metendo no mesmo balaio quem exige
      // licença prévia e quem só tem obrigação depois do despacho.
      ...[...porOrgao.entries()].map(([orgao, ts]) => {
        const comLpco = ts.filter(exigeLicenca).length;
        const alertas = ts.filter((t) => (val(t.tipo_ta) ?? '').toLowerCase().includes('alerta')).length;
        const compl = complementaresPara(codigo, orgao)[0];
        const veredito = comLpco > 0
          ? `exige LPCO prévio (${comLpco} de ${ts.length}) — minuta disponível`
          : alertas > 0
            ? 'sem anuência prévia no Siscomex'
            : `${ts.length} tratamento(s)`;
        return `${orgao}: ${veredito}${compl ? `. ${compl.identificacao} — ${compl.destaque}` : '.'}`;
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
      // TODAS as normas, não só a primeira: a base dos pneus tem cinco, e a que
      // rege pneus inservíveis (Conama 416/2009) não é a primeira da lista.
      extractRefs(t.base_legal).forEach((ref) => {
        if (!refs.has(ref)) {
          refs.set(ref, `${val(t.orgao_npi) ?? 'Órgão'} · ${val(t.base_legal) ?? ''}`.trim());
        }
      });
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

  /**
   * Manda a consulta para o pipeline da Home com o que ela realmente apurou:
   * quantos tratamentos impedem o desembaraço e quais órgãos precisam anuir.
   */
  const salvarNoProcesso = () => {
    if (!data) return;
    const orgaos = [...new Set(grupos.map(([orgao]) => orgao))];
    registrarProcesso({
      nome: `Anuência · NCM ${val(data.ncm.codigo) ?? ncm}`,
      agente: 'compliance',
      status: totalBloqueios > 0 ? 'pendente' : 'concluido',
      canal: totalBloqueios > 0 ? 'vermelho' : 'verde',
      resumo: `${data.total_orgaos} órgão(s) · ${data.tratamentos.length} tratamento(s)`
        + (totalBloqueios > 0 ? ` · ${totalBloqueios} impedem desembaraço` : ''),
      lpcoPendentes: totalBloqueios,
      orgaos,
    });
    setSalvo(true);
  };

  /**
   * Normas que o Portal Único não cita mas que o operador precisa. Ver
   * src/engine/normasComplementares.ts.
   */
  const complementares = React.useMemo(
    () => complementaresPara(val(data?.ncm.codigo) ?? ncm),
    [data, ncm],
  );

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
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Verificador de Anuência e Regras de Importação</h2>
              <p className="text-sm text-slate-400">Quais órgãos precisam autorizar a importação deste NCM e o que cada um exige</p>
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
                        // Todas as normas da base, não só a primeira.
                        const refs = extractRefs(t.base_legal);
                        const eAlerta = (val(t.tipo_ta) ?? '').toLowerCase().includes('alerta');
                        // Norma complementar deste órgão para este NCM, se houver.
                        const compl = complementaresPara(val(data.ncm.codigo) ?? ncm, orgao)[0];
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
                              {/* "Alerta" não gera licença. Dizer isso no colapsado evita
                                  que o operador abra a regra procurando um LPCO que não existe. */}
                              {eAlerta && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">
                                  <Info className="h-2.5 w-2.5" />
                                  {compl ? 'obrigação pós-despacho' : 'sem anuência prévia'}
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

                                {/* Base legal clicável (P3) — uma pílula por norma */}
                                {val(t.base_legal) && (
                                  <div>
                                    <span className="font-semibold text-slate-500">Base legal: </span>
                                    {refs.length === 0 ? (
                                      <span className="text-slate-600">{val(t.base_legal)}</span>
                                    ) : (
                                      <span className="inline-flex flex-wrap gap-1 align-middle">
                                        {refs.map((r) => (
                                          <button
                                            key={r}
                                            onClick={() => carregarNorma(r)}
                                            className="rounded-md bg-teal-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teal-800 ring-1 ring-teal-100 transition-colors duration-150 hover:bg-teal-100"
                                          >
                                            {r}
                                          </button>
                                        ))}
                                      </span>
                                    )}
                                    {refs.map((r) => {
                                      const nd = norma[r];
                                      if (!nd) return null;
                                      return (
                                        <div key={`n-${r}`} className="mt-1">
                                          {nd === 'loading' && (
                                            <span className="inline-flex items-center gap-1 text-slate-400">
                                              <Loader2 className="h-3 w-3 animate-spin" /> consultando {r}…
                                            </span>
                                          )}
                                          {nd === 'erro' && (
                                            <span className="text-amber-600">{r}: texto não disponível na base.</span>
                                          )}
                                          {typeof nd === 'object' && (
                                            <div className="rounded-lg bg-white p-2 text-slate-600 ring-1 ring-slate-200">
                                              <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                                {r} · {nd.tipo} · {nd.orgao_emissor}
                                              </span>
                                              {nd.ementa}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    <p className="mt-0.5 text-slate-400">{val(t.base_legal)}</p>
                                  </div>
                                )}

                                {/* Sem licença a emitir: diz o que fazer no lugar.
                                    O texto vem da norma complementar (com artigo e
                                    fonte), não de suposição sobre o tipo do TA. */}
                                {!exigeLicenca(t) && eAlerta && (
                                  <div className="mt-1 rounded-lg border border-sky-200 bg-sky-50/60 p-2.5">
                                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                                      <Info className="h-3 w-3" /> Aconselhamento
                                    </p>
                                    {compl ? (
                                      <>
                                        <p className="mt-1 text-[11px] leading-relaxed text-slate-700">{compl.destaque}</p>
                                        <p className="mt-1 text-[10px] text-slate-500">
                                          {compl.identificacao} · vigente desde{' '}
                                          {new Date(`${compl.vigenciaDesde}T00:00:00`).toLocaleDateString('pt-BR')} ·{' '}
                                          <a href={compl.fonte} target="_blank" rel="noreferrer"
                                             className="underline decoration-dotted underline-offset-2 hover:text-sky-700">
                                            texto oficial
                                          </a>
                                          . Detalhamento no painel abaixo.
                                        </p>
                                      </>
                                    ) : (
                                      <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
                                        Tratamento informativo: não há LPCO a deferir antes do registro.
                                        Confirme no Simulador do Portal Único se há obrigação acessória
                                        associada a este NCM.
                                      </p>
                                    )}
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

            {complementares.map((n) => (
              <div key={n.identificacao} className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{n.identificacao}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{n.ementa}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                    curadoria · fora do Portal Único
                  </span>
                </div>

                <p className="mt-2.5 rounded-lg bg-white p-2.5 text-xs font-medium leading-relaxed text-slate-800 ring-1 ring-amber-100">
                  {n.destaque}
                </p>

                <ul className="mt-2.5 space-y-1">
                  {n.pontos.map((p, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-slate-600">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-[10px] text-slate-400">
                  Vigente desde {new Date(`${n.vigenciaDesde}T00:00:00`).toLocaleDateString('pt-BR')} ·{' '}
                  <a href={n.fonte} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-amber-700">
                    texto oficial no IBAMA
                  </a>
                </p>
              </div>
            ))}

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
