/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canvas de "Classificação NCM": busca, árvore tarifária e carga tributária.
 *
 * Antes esta rota apenas ativava a intenção "classify" no copiloto e deixava o
 * canvas na tela genérica de auditoria — o item do menu abria uma tela que não
 * era dele.
 *
 * DUAS ENTRADAS, UM RESULTADO
 * ---------------------------
 *  - Código (ex.: 3924.10): vai direto ao grafo, GET /api/sat-graph/ncm/:code.
 *  - Descrição (ex.: "garrafa térmica de inox"): POST /api/classify, que faz
 *    Graph-RAG — o grafo dá os candidatos e o LLM escolhe pelo significado.
 *    Quando nada casa, a resposta diz que não encontrou; não existe NCM de
 *    consolo.
 *
 * O QUE A TELA AFIRMA E O QUE ELA RECUSA AFIRMAR
 * ----------------------------------------------
 * A árvore e os órgãos anuentes vêm do grafo de produção. A carga tributária
 * vem de `tributosNcm.ts`, que declara a fonte de cada linha e mostra como
 * vazio o que não tem fonte (II fora da lista curada, e IPI sempre — não há
 * TEC/TIPI carregada aqui).
 *
 * Soluções de Consulta COSIT: não há base vinculada neste repositório. O painel
 * existe, diz que não há vínculo e leva à busca oficial da RFB. Exibir números
 * de solução plausíveis seria fabricar precedente fiscal.
 */
import React, { useState } from 'react';
import {
  AlertTriangle, BookOpen, ChevronRight, ExternalLink, Info,
  Loader2, Scale, Search, ShieldAlert, Sparkles,
} from 'lucide-react';
import { tributosPara, FONTE_TEC, FONTE_TIPI } from '../../data/tributosNcm';

interface NivelNcm {
  codigo: string;
  nivel: string;
  descricao: string;
}

interface OrgaoAnuente {
  orgao: string;
  orgao_nome?: string | null;
  exige_lpco?: boolean;
  tratamentos?: unknown[];
}

interface Resultado {
  ncm: string;
  descricaoCompleta: string | null;
  hierarquia: NivelNcm[];
  orgaos: OrgaoAnuente[];
  /** Preenchido só quando a busca foi por descrição. */
  justificativa?: string;
  confianca?: string;
  metodo?: string;
  alternativas?: { ncm: string; descricao_completa?: string; descricao?: string }[];
}

const EXEMPLOS = [
  { codigo: '3924.10.00', rotulo: 'Utensílios de cozinha' },
  { codigo: '8517.13.00', rotulo: 'Smartphones' },
  { codigo: '3004.90.99', rotulo: 'Medicamentos' },
];

/** Rótulo legível para o nível hierárquico devolvido pelo grafo. */
const NIVEL_LABEL: Record<string, string> = {
  SECTION: 'Seção', CHAPTER: 'Capítulo', HEADING: 'Posição',
  SUBHEADING: 'Subposição', ITEM: 'Item', SUBITEM: 'Subitem', NCM: 'NCM',
};

const rotuloNivel = (nivel: string, codigo: string): string => {
  const direto = NIVEL_LABEL[String(nivel ?? '').toUpperCase()];
  if (direto) return direto;
  // Sem level_code confiável, o comprimento do código identifica o degrau.
  const n = codigo.replace(/\D/g, '').length;
  if (n <= 2) return 'Capítulo';
  if (n <= 4) return 'Posição';
  if (n <= 6) return 'Subposição';
  return 'NCM';
};

/** Entrada só com dígitos e pontos, com 4+ dígitos, é código. */
const pareceCodigo = (texto: string): boolean =>
  /^[\d.\s-]+$/.test(texto.trim()) && texto.replace(/\D/g, '').length >= 4;

export default function NcmClassifierWorkspace() {
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);

  /** Traz a árvore e os anuentes de um código já conhecido. */
  const carregarPorCodigo = async (codigo: string): Promise<Partial<Resultado>> => {
    const r = await fetch(`/api/sat-graph/ncm/${encodeURIComponent(codigo.replace(/\D/g, ''))}`);
    const j = await r.json();
    if (!j?.success) throw new Error(j?.error || `NCM ${codigo} não encontrado no grafo.`);
    return {
      ncm: j.ncm?.codigo ?? codigo,
      descricaoCompleta: j.ncm?.descricao_completa ?? null,
      hierarquia: j.ncm?.hierarquia ?? [],
      orgaos: j.orgaosAnuentes ?? [],
    };
  };

  const consultar = async (entrada?: string) => {
    const texto = (entrada ?? busca).trim();
    if (!texto || loading) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    try {
      if (pareceCodigo(texto)) {
        const base = await carregarPorCodigo(texto);
        setRes(base as Resultado);
      } else {
        const r = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // O handler lê `text` (ou `description`) — enviar `texto` devolve 400.
          body: JSON.stringify({ text: texto }),
        });
        const j = await r.json();
        if (!j?.success) throw new Error(j?.error || 'Não consegui classificar.');
        if (!j.encontrado) { setErro(j.mensagem || 'Sem correspondência na NCM oficial.'); return; }
        // O /api/classify não devolve a cadeia nível a nível; buscamos no grafo.
        const base = await carregarPorCodigo(j.codigo_canonical ?? j.ncm);
        setRes({
          ...(base as Resultado),
          ncm: j.ncm ?? base.ncm,
          descricaoCompleta: j.descricao_completa ?? base.descricaoCompleta ?? null,
          justificativa: j.justificativa,
          confianca: j.confianca,
          metodo: j.metodo,
          alternativas: j.alternativas ?? [],
        });
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const tributos = res ? tributosPara(res.ncm) : [];

  return (
    <section className="h-full flex-1 overflow-y-auto bg-slate-50" id="ncm-classifier-workspace">
      <div className="mx-auto max-w-3xl px-6 py-6">

        {/* Barra de título */}
        {/* Mesma razão do canvas de auditoria: a coluna encolhe quando o menu
            lateral expande, e o título precisa poder empurrar o badge para
            baixo em vez de ser espremido. */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">
                Classificador e Sugestor de NCM
              </h2>
              <p className="text-sm text-slate-400">
                Descreva o produto ou informe o código — devolvo a cadeia oficial e quem precisa autorizar
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
            NCM oficial vigente
          </span>
        </div>

        {/* Busca */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2">
          <Search className="ml-1 h-4 w-4 shrink-0 text-violet-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void consultar(); }}
            placeholder="Ex.: garrafa térmica de inox com parede dupla de vidro — ou o código 3924.10"
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            onClick={() => void consultar()}
            disabled={loading || !busca.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sugerir NCM
          </button>
        </div>

        {/* Exemplos rápidos */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span>Exemplos:</span>
          {EXEMPLOS.map((ex) => (
            <button
              key={ex.codigo}
              onClick={() => { setBusca(ex.codigo); void consultar(ex.codigo); }}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700"
            >
              {ex.codigo} <span className="font-sans text-slate-400">· {ex.rotulo}</span>
            </button>
          ))}
        </div>

        {erro && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Estado vazio — diz o que a tela faz, sem simular resultado */}
        {!res && !loading && !erro && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">A cadeia inteira, não só o código</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
              Um item folha isolado costuma ser literalmente &ldquo;Outros&rdquo;. O sentido está em
              capítulo, posição e subposição — e é essa cadeia que sustenta a classificação perante a
              fiscalização.
            </p>
          </div>
        )}

        {res && (
          <div className="mt-5 space-y-4">

            {/* Identificação */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-semibold tracking-tight text-slate-900">{res.ncm}</span>
                {res.confianca && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    res.confianca === 'alta' ? 'bg-emerald-100 text-emerald-800'
                    : res.confianca === 'média' ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                  }`}>
                    confiança {res.confianca}
                  </span>
                )}
                {res.metodo === 'graph_rag' && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    escolhido no grafo + IA
                  </span>
                )}
              </div>
              {res.descricaoCompleta && (
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{res.descricaoCompleta}</p>
              )}
              {res.justificativa && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <span>{res.justificativa}</span>
                </p>
              )}
            </div>

            {/* Árvore da NCM */}
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Árvore da NCM</h3>
                <p className="text-xs text-slate-400">Cadeia oficial do capítulo até o item, direto do grafo</p>
              </div>
              <ol className="p-4">
                {res.hierarquia.map((n, i) => (
                  <li key={`${n.codigo}-${i}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        i === res.hierarquia.length - 1 ? 'bg-violet-600' : 'bg-slate-300'
                      }`} />
                      {i < res.hierarquia.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className="min-w-0 pb-3" style={{ paddingLeft: `${Math.min(i, 5) * 8}px` }}>
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-800">{n.codigo}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">
                          {rotuloNivel(n.nivel, n.codigo)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                        {n.descricao.replace(/^[-\s]+/, '')}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Carga tributária */}
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Carga tributária na importação</h3>
                <p className="text-xs text-slate-400">Cada linha mostra sua fonte — o que não tem fonte aqui aparece vazio</p>
              </div>
              <div className="divide-y divide-slate-100">
                {tributos.map((t) => (
                  <div key={t.sigla} className="flex items-start gap-3 px-5 py-3">
                    <span className="w-16 shrink-0 font-mono text-xs font-semibold text-slate-700">{t.sigla}</span>
                    <span className="w-20 shrink-0 text-right font-mono text-sm font-semibold">
                      {t.pct === null
                        ? <span className="text-slate-300">—</span>
                        : <span className="text-slate-900">{t.pct.toLocaleString('pt-BR')}%</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-700">{t.nome}</span>
                      <span className="block text-[11px] leading-relaxed text-slate-400">{t.fonte}</span>
                      {t.ressalva && (
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-amber-700">{t.ressalva}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
                <span>Consulte a alíquota oficial:</span>
                <a href={FONTE_TEC} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                  TEC <ExternalLink className="h-3 w-3" />
                </a>
                <a href={FONTE_TIPI} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                  TIPI <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-slate-300">·</span>
                <span>o cálculo com estas alíquotas roda no Custo de Importação.</span>
              </div>
            </div>

            {/* Órgãos anuentes */}
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Órgãos que controlam este NCM</h3>
                <p className="text-xs text-slate-400">
                  {res.orgaos.length === 0
                    ? 'Nenhum tratamento administrativo mapeado no grafo'
                    : `${res.orgaos.length} órgão(s) com regra sobre este código`}
                </p>
              </div>
              {res.orgaos.length > 0 && (
                <div className="flex flex-wrap gap-2 p-4">
                  {res.orgaos.map((o) => (
                    <span
                      key={o.orgao}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        o.exige_lpco
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                      title={o.orgao_nome ?? undefined}
                    >
                      {o.exige_lpco ? <ShieldAlert className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                      {o.orgao}
                      <span className="font-normal opacity-70">
                        {o.exige_lpco ? '· exige LPCO' : '· informativo'}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                O detalhe de cada tratamento — número do TA, exigências e base legal — fica em
                <strong className="font-semibold text-slate-500"> Risco &amp; LPCO</strong>.
              </p>
            </div>

            {/* Soluções de Consulta COSIT */}
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Soluções de Consulta COSIT/RFB</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs leading-relaxed text-slate-500">
                  Não há base de Soluções de Consulta vinculada a este NCM no ComexPilot. Preferimos deixar
                  o campo vazio a exibir precedente que não podemos comprovar — uma solução citada por
                  engano numa contestação custa mais do que a ausência dela.
                </p>
                <a
                  href="https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/consultas"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                >
                  Buscar na base oficial da RFB <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Alternativas consideradas */}
            {res.alternativas && res.alternativas.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <h3 className="text-sm font-semibold text-slate-900">Outros candidatos considerados</h3>
                  <p className="text-xs text-slate-400">Descartados na escolha — clique para abrir a cadeia de qualquer um</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {res.alternativas.map((a) => (
                    <button
                      key={a.ncm}
                      onClick={() => { setBusca(a.ncm); void consultar(a.ncm); }}
                      className="group flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                    >
                      <span className="font-mono text-xs font-semibold text-slate-700">{a.ncm}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                        {a.descricao_completa || a.descricao}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-violet-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {loading && !res && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando a NCM oficial…
          </div>
        )}

      </div>
    </section>
  );
}
