/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de Conformidade Aduaneira sobre o SAT-Graph (Neo4j).
 * Consulta /api/sat-graph/ncm/:code e mostra os órgãos anuentes + TAs/LPCO que
 * incidem sobre o NCM, direto do grafo de produção (somente leitura).
 */
import React, { useState } from 'react';
import { AlertTriangle, Loader2, Network, Search, ShieldCheck, X } from 'lucide-react';

interface Tratamento {
  orgao_label?: string;
  orgao_npi?: string;
  orgao_nome?: string;
  ta_id?: string;
  modelo?: string;
  nome_modelo?: string;
  tipo_ta?: string;
  impede_desembaraco?: string;
  prazo?: string;
  base_legal?: string;
  vigencia?: string;
}
interface Resultado {
  ncm: { codigo?: string; descricao?: string };
  tratamentos: Tratamento[];
  total_orgaos: number;
}

const impedeBadge = (v?: string) => {
  const sim = (v || '').toLowerCase().startsWith('s');
  return sim
    ? 'bg-rose-100 text-rose-700'
    : 'bg-slate-100 text-slate-600';
};

export default function ComplianceWorkspace({ onClose }: { onClose: () => void }) {
  const [ncm, setNcm] = useState('30023060');
  const [data, setData] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const consultar = async () => {
    const code = ncm.replace(/\D/g, '');
    if (!code) return;
    setLoading(true); setErro(null); setData(null);
    try {
      const resp = await fetch(`/api/sat-graph/ncm/${code}`);
      const d = await resp.json();
      if (d.success) setData(d);
      else setErro(d.error || 'Consulta indisponível.');
    } catch {
      setErro('Falha ao contatar o SAT-Graph. Rode o servidor (npm run dev) com NEO4J_* no .env.');
    } finally {
      setLoading(false);
    }
  };

  // Agrupa os tratamentos por órgão anuente.
  const grupos = (data?.tratamentos ?? []).reduce<Record<string, Tratamento[]>>((acc, t) => {
    const k = t.orgao_npi || t.orgao_label || 'Outro';
    (acc[k] ||= []).push(t);
    return acc;
  }, {});

  return (
    <section className="h-full flex-1 overflow-y-auto bg-slate-100/60" id="compliance-workspace">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white"><Network className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Motor de Conformidade · SAT-Graph</h2>
              <p className="text-sm text-slate-400">Órgãos anuentes e tratamentos administrativos (TA/LPCO) por NCM — grafo Neo4j</p>
            </div>
          </div>
          <button onClick={onClose} title="Fechar" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Busca */}
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2">
          <Search className="ml-1 h-4 w-4 shrink-0 text-teal-500" />
          <input
            value={ncm}
            onChange={(e) => setNcm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') consultar(); }}
            placeholder="NCM (ex.: 3002.30.60 · vacina; 8470.90.10 · máq. franquear)"
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 font-mono text-sm text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-sans"
          />
          <button onClick={consultar} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Consultar
          </button>
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <span className="font-mono text-sm font-semibold text-slate-900">{data.ncm.codigo}</span>
                <p className="text-xs text-slate-500">{data.ncm.descricao}</p>
              </div>
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                {data.total_orgaos} órgão(s) anuente(s) · {data.tratamentos.length} TA(s)
              </span>
            </div>

            {data.tratamentos.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                <ShieldCheck className="mx-auto mb-1 h-8 w-8 stroke-1 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-700">Sem tratamento administrativo mapeado</p>
                <p className="text-xs text-slate-400">Nenhuma regra APLICA_SOBRE este NCM no grafo. Confirme sempre no Simulador do Portal Único.</p>
              </div>
            ) : (
              Object.entries(grupos).map(([orgao, tas]: [string, Tratamento[]]) => (
                <div key={orgao} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                    <h3 className="text-sm font-semibold text-slate-900">{orgao}</h3>
                    <span className="font-mono text-[10px] text-slate-400">{tas[0]?.orgao_nome}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {tas.map((t, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">{t.ta_id}</span>
                          <span className="text-xs text-slate-600">{t.tipo_ta || t.nome_modelo || 'Tratamento administrativo'}</span>
                          {t.impede_desembaraco && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${impedeBadge(t.impede_desembaraco)}`}>
                              {(t.impede_desembaraco || '').toLowerCase().startsWith('s') ? 'impede desembaraço' : 'não impede'}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                          {t.modelo && <span>Modelo LPCO: <span className="font-mono text-slate-600">{t.modelo}</span></span>}
                          {t.prazo && <span>Prazo: {t.prazo}</span>}
                          {t.vigencia && <span>Vigência: {t.vigencia}</span>}
                        </div>
                        {t.base_legal && <p className="mt-1 text-[11px] text-slate-500"><span className="font-medium">Base legal:</span> {t.base_legal}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            <p className="text-[10px] leading-relaxed text-slate-400">
              Fonte: SAT-Graph (Neo4j, snapshot NPI). Informativo — a incidência efetiva deve ser confirmada no Simulador de TA do Portal Único.
            </p>
          </div>
        )}

        {!data && !erro && !loading && (
          <p className="text-xs text-slate-400">Digite um NCM e clique em Consultar. Exemplos: 3002.30.60 (vacina · MAPA), 8470.90.10 (ECT), 7102.10.00 (diamante · ANM).</p>
        )}
      </div>
    </section>
  );
}
