/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * POST /api/classify — classificação fiscal pelo SAT-Graph.
 * Busca o NCM nas descrições oficiais do grafo e, para o melhor candidato,
 * traz os órgãos anuentes que incidem sobre ele.
 *
 * Regra de honestidade: quando o grafo não encontra nada, a resposta diz que
 * NÃO encontrou. Nunca devolve um NCM "de consolo" — o classificador anterior
 * caía num fallback de cosmético e classificava "pneu de moto" como protetor
 * solar.
 */
import type { Request, Response } from 'express';
import { getDriver } from './neo4j.js';
import { buscarNcmPorDescricao, termosDeBusca } from './ncmSearch.js';
import { conformidadeCompleta } from './ncmCompliance.js';
import { GEMINI_MODEL, callOpenRouter, extractJson } from './llm.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Graph-RAG: o grafo traz os candidatos (recall) e o LLM escolhe pelo
 * significado (precisão). A busca lexical sozinha erra em casos semânticos —
 * "protetor solar" casa com "estearina solar" sem entender que é cosmético.
 * Sem LLM disponível, devolvemos o melhor candidato lexical com a confiança
 * honesta que ele merece.
 */
async function escolherComLlm(
  texto: string,
  candidatos: { ncm: string; descricao: string; caminho: string }[],
  contextoLegal?: string,
): Promise<{ ncm: string; justificativa: string } | null> {
  const lista = candidatos
    .map((c, i) => `${i + 1}. NCM ${c.ncm} — ${c.caminho}${c.descricao}`)
    .join('\n');
  const prompt = [
    `Você é um classificador fiscal aduaneiro brasileiro.`,
    `Produto descrito pelo importador: "${texto}".`,
    ``,
    `Candidatos extraídos da NCM oficial vigente:`,
    lista,
    ``,
    ...(contextoLegal
      ? ['', 'Exigências regulatórias mapeadas no grafo para o 1º candidato:', contextoLegal]
      : []),
    ``,
    `Escolha o MAIS adequado ao produto. Se nenhum servir, responda ncm "NENHUM".`,
    `Na justificativa, cite a exigência ou o impedimento legal relevante quando houver.`,
    `Responda somente JSON: {"ncm":"0000.00.00","justificativa":"uma frase"}`,
  ].join('\n');

  const key = process.env.GEMINI_API_KEY;
  if (key && key !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const r = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
      const j = extractJson(r.text ?? '') as { ncm?: string; justificativa?: string } | null;
      if (j?.ncm) return { ncm: j.ncm, justificativa: j.justificativa ?? '' };
    } catch (e) {
      console.warn('classify: Gemini indisponível, tentando OpenRouter —', (e as Error).message);
    }
  }
  const raw = await callOpenRouter(prompt, { json: true });
  const j = raw ? (extractJson(raw) as { ncm?: string; justificativa?: string } | null) : null;
  return j?.ncm ? { ncm: j.ncm, justificativa: j.justificativa ?? '' } : null;
}

export async function classifyHandler(req: Request, res: Response): Promise<void> {
  if (!getDriver()) {
    res.status(503).json({ success: false, error: 'Neo4j não configurado — classificação por grafo indisponível.' });
    return;
  }
  const texto = String(req.body?.text ?? req.body?.description ?? '').trim();
  if (!texto) {
    res.status(400).json({ success: false, error: 'Descreva o produto para classificar.' });
    return;
  }

  try {
    const candidatos = await buscarNcmPorDescricao(texto, 6);

    if (candidatos.length === 0) {
      res.json({
        success: true,
        encontrado: false,
        termos: termosDeBusca(texto),
        mensagem:
          'Não encontrei correspondência nas descrições oficiais da NCM para estes termos. ' +
          'Descreva o material, a função e a forma de apresentação do produto.',
      });
      return;
    }

    // Travessia profunda do 1º candidato — serve de contexto regulatório ao LLM.
    let melhor = candidatos[0];
    let orgaosAnuentes = await conformidadeCompleta(melhor.codigo_canonical);

    const contextoLegal = orgaosAnuentes
      .slice(0, 4)
      .map((o) => {
        const tipos = [...new Set(o.tratamentos.map((t) => t.tipo_ta).filter(Boolean))].join(', ');
        const base = o.bases_legais[0] ?? 'base legal não informada';
        return `- ${o.orgao}: ${o.tratamentos.length} TA(s)${tipos ? ` (${tipos})` : ''} · ${base}`;
      })
      .join('\n');

    // Graph-RAG: o LLM escolhe entre os candidatos, já ciente das exigências.
    let escolhidoPorIa = false;
    let justificativaIa = '';
    const escolha = await escolherComLlm(texto, candidatos, contextoLegal || undefined);
    if (escolha && escolha.ncm !== 'NENHUM') {
      const alvo = escolha.ncm.replace(/\D/g, '');
      const achado = candidatos.find((c) => c.codigo_canonical === alvo || c.ncm === escolha.ncm);
      if (achado && achado.codigo_canonical !== melhor.codigo_canonical) {
        // O LLM trocou de candidato: refaz a travessia para o NCM escolhido.
        melhor = achado;
        orgaosAnuentes = await conformidadeCompleta(melhor.codigo_canonical);
        escolhidoPorIa = true;
        justificativaIa = escolha.justificativa;
      } else if (achado) {
        escolhidoPorIa = true;
        justificativaIa = escolha.justificativa;
      }
    }
    const orgaos = orgaosAnuentes.map((o) => o.orgao);
    const totalTratamentos = orgaosAnuentes.reduce((n, o) => n + o.tratamentos.length, 0);
    const exigeLpco = orgaosAnuentes.some((o) => o.exige_lpco);

    // Confiança derivada da cobertura dos termos — sem número inventado.
    const cobertura = melhor.hits / Math.max(melhor.termos_total, 1);
    const confianca = cobertura >= 0.99 ? 'alta' : cobertura >= 0.5 ? 'média' : 'baixa';

    res.json({
      success: true,
      encontrado: true,
      ncm: melhor.ncm,
      codigo_canonical: melhor.codigo_canonical,
      descricao_oficial: melhor.descricao,
      caminho: melhor.caminho,
      confianca: escolhidoPorIa ? (confianca === 'baixa' ? 'média' : confianca) : confianca,
      metodo: escolhidoPorIa ? 'graph_rag' : 'busca_lexical',
      justificativa: justificativaIa || undefined,
      termos_casados: `${melhor.hits}/${melhor.termos_total}`,
      orgaos_anuentes: orgaos,
      orgaosAnuentes,          // detalhe completo: TAs, exigências e base legal
      exige_lpco: exigeLpco,
      total_tratamentos: totalTratamentos,
      alternativas: candidatos.slice(1, 4).map((c) => ({ ncm: c.ncm, descricao: c.descricao })),
    });
  } catch (err) {
    console.error('classifyHandler', err);
    res.status(502).json({ success: false, error: String((err as Error).message || err) });
  }
}
