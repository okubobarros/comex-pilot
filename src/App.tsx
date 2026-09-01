/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AppView, AuditAlert, ChatIntent, ChatMessage, InvoiceAnalysis, InvoiceItem, LiPrefillData, NcmRule, TaskId, WorkspaceMode, WorkspaceStatus } from './types';
import { DEFAULT_NCM_RULES, PRESET_SCENARIOS } from './data/mockScenarios';
import { buildHeuristicAnalysis, computeAlerts, computeSavingsBrl, findRuleForNcm } from './engine/rulesEngine';
import { classifyProduct, formatClassification } from './engine/classifier';
import NavRail from './components/NavRail';
import Home from './components/Home';
import ChatPanel, { SuggestionPill } from './components/ChatPanel';
import Workspace from './components/Workspace';
import LiMinutaModal from './components/LiMinutaModal';
import TopBar from './components/os/TopBar';
import AgentDock, { AgentId } from './components/os/AgentDock';
import EvidencePanel from './components/os/EvidencePanel';
import type { Processo } from './context/ProcessContext';
import { useEvidence } from './context/EvidenceContext';

const CHAT_THOUGHTS = [
  '🔍 Lendo documento...',
  '⚡ Cruzando NCMs com regras ANVISA/MAPA...',
  '📈 Verificando preços de referência...'
];

const SUGGESTIONS: SuggestionPill[] = [
  { label: 'Auditar Invoice de Cosméticos (Coreia)', presetIndex: 0 },
  { label: 'Verificar Antidumping Stanley (China)', presetIndex: 1 },
  { label: 'Analisar Isenção de Resina Epóxi (EUA)', presetIndex: 2 }
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  text: 'Olá — sou o agente aduaneiro do **ComexPilot**. Anexe uma Invoice, envie o áudio do despachante ou escolha uma auditoria rápida abaixo. Eu cruzo NCMs com as bases da ANVISA, MAPA, ANATEL e GECEX e devolvo o veredito no workspace ao lado.',
};

const MIN_LOADING_MS = 2500;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [customRules] = useState<NcmRule[]>(DEFAULT_NCM_RULES);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>('empty');
  const [stepIndex, setStepIndex] = useState(0);
  const [activeAnalysis, setActiveAnalysis] = useState<InvoiceAnalysis | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'success' | 'simulated'>('success');
  const [liPrefill, setLiPrefill] = useState<LiPrefillData | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('audit');
  const [view, setView] = useState<AppView>('home');
  const [chatIntent, setChatIntent] = useState<ChatIntent>('audit');
  const { setEvidence } = useEvidence();

  const msgCounter = useRef(0);

  // Avança os "pensamentos do agente" no chat enquanto o workspace processa
  useEffect(() => {
    if (workspaceStatus !== 'loading') return;
    setStepIndex(0);
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, CHAT_THOUGHTS.length - 1));
    }, 780);
    return () => clearInterval(interval);
  }, [workspaceStatus]);

  const pushMessage = (msg: Omit<ChatMessage, 'id'>) => {
    msgCounter.current += 1;
    // id resolvido fora do updater: dois pushes no mesmo batch não podem colidir
    const message: ChatMessage = { ...msg, id: `msg-${msgCounter.current}` };
    setMessages((prev) => [...prev, message]);
  };

  const summarize = (analysis: InvoiceAnalysis) => {
    const red = analysis.alerts.filter(a => a.severity === 'red').length;
    const yellow = analysis.alerts.filter(a => a.severity === 'yellow').length;
    const green = analysis.alerts.filter(a => a.severity === 'green').length;
    return `Auditoria de **${analysis.fileName}** concluída. Probabilidade de canal vermelho: **${analysis.riskScore}%**. O motor de regras apontou **${red} bloqueio(s) crítico(s)**, ${yellow} ponto(s) de atenção e ${green} oportunidade(s) tributária(s). O veredito completo está no workspace ao lado.`;
  };

  /**
   * Núcleo da jornada agentic: mostra o loading com os pensamentos do agente
   * por no mínimo 2s, resolve a análise, recalcula os alertas pelo motor de
   * regras e publica o veredito no chat + workspace.
   */
  const runAudit = async (getAnalysis: () => Promise<InvoiceAnalysis> | InvoiceAnalysis, getExtraReply?: () => string | undefined) => {
    setIsBusy(true);
    setWorkspaceStatus('loading');

    try {
      const [rawAnalysis] = await Promise.all([
        Promise.resolve(getAnalysis()),
        delay(MIN_LOADING_MS)
      ]);

      const { alerts, riskScore } = computeAlerts(rawAnalysis.items, customRules);
      const finalAnalysis: InvoiceAnalysis = { ...rawAnalysis, alerts, riskScore };

      setActiveAnalysis(finalAnalysis);
      setWorkspaceStatus('complete');

      const canal = finalAnalysis.riskScore >= 70 ? 'vermelho' : finalAnalysis.riskScore >= 30 ? 'amarelo' : 'verde';
      const refs = new Set<string>();
      finalAnalysis.alerts.forEach((a) => {
        if (`${a.title} ${a.baseLegal}`.toUpperCase().includes('ANVISA')) {
          refs.add('RDC 752/2022');
          refs.add('RDC 907/2024');
        }
      });
      setEvidence({
        agent: 'audit',
        titulo: `Auditoria · ${finalAnalysis.fileName}`,
        steps: [
          `Extraí ${finalAnalysis.items.length} item(ns) da fatura e normalizei NCM e valores.`,
          'Cruzei cada NCM com o motor de regras (anuência, antidumping, valoração aduaneira).',
          `Score de risco calculado: ${finalAnalysis.riskScore}% — canal ${canal}.`,
        ],
        citations: [...refs].map((ref) => ({ ref })),
      });

      const extraReply = getExtraReply?.();
      if (extraReply) pushMessage({ role: 'assistant', text: extraReply });
      pushMessage({ role: 'assistant', text: summarize(finalAnalysis) });
    } catch (err) {
      console.error(err);
      setWorkspaceStatus(activeAnalysis ? 'complete' : 'empty');
      pushMessage({ role: 'assistant', text: 'Encontrei uma falha operacional ao processar este comando. Pode tentar novamente ou usar uma das auditorias rápidas.' });
    } finally {
      setIsBusy(false);
    }
  };

  /* ---------- Análise completa (Auditar Invoice) → Workspace ---------- */

  const auditFromText = (text: string) => runAudit(async () => {
    try {
      const response = await fetch('/api/analyze-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceText: text, customRules })
      });
      if (!response.ok) throw new Error('Falha na comunicação com o servidor aduaneiro.');

      const data = await response.json();
      if (data.success && data.analysis) {
        setAiStatus(data.method === 'gemini_ai_auditor' ? 'success' : 'simulated');
        return data.analysis as InvoiceAnalysis;
      }
      throw new Error(data.error || 'Não foi possível extrair os itens da Invoice.');
    } catch (err) {
      console.error(err);
      setAiStatus('simulated');
      return buildHeuristicAnalysis(text, customRules);
    }
  });

  /* ---------- Intenções rápidas (Classificar / Risco) → Chat ---------- */

  // Consulta multimodal rápida que responde no próprio feed, sem tocar no canvas
  const runQuickReply = (buildReply: () => Promise<string> | string) => {
    setIsBusy(true);
    Promise.all([Promise.resolve(buildReply()), delay(900)])
      .then(([reply]) => pushMessage({ role: 'assistant', text: reply }))
      .catch((err) => {
        console.error(err);
        pushMessage({ role: 'assistant', text: 'Não consegui concluir esta consulta rápida. Tente reformular ou anexar mais detalhes.' });
      })
      .finally(() => setIsBusy(false));
  };

  /**
   * Classificação fiscal pelo SAT-Graph: busca nas descrições oficiais dos
   * 15.156 NCMs e, quando há LLM disponível, escolha semântica entre os
   * candidatos (Graph-RAG). Cai na heurística local só se o backend falhar.
   */
  const classifyReply = (text: string, sourceLabel?: string) =>
    runQuickReply(async () => {
      try {
        const resp = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const d = resp.ok ? await resp.json() : { success: false };

        if (d.success && d.encontrado) {
          const conf: Record<string, string> = { alta: '🟢 Alta', 'média': '🟡 Média', baixa: '🔴 Baixa' };
          const orgaos: string[] = d.orgaos_anuentes ?? [];

          // Trilha auditável no Painel de Evidências: exigências e base legal
          // de cada órgão, direto da travessia do grafo.
          interface OrgaoDetalhe {
            orgao: string;
            orgao_nome?: string | null;
            exige_lpco: boolean;
            bases_legais: string[];
            tratamentos: { ta_numero?: string | null; tipo_ta?: string | null }[];
          }
          const detalhe: OrgaoDetalhe[] = d.orgaosAnuentes ?? [];
          if (detalhe.length > 0) {
            const refs = new Map<string, string>();
            detalhe.forEach((o) =>
              o.bases_legais.forEach((b) => {
                const m = b.match(/(RDC|Lei|Decreto|Portaria|Resolução|IN)[^,;/]*?[\d.]+[/\d]*/i);
                if (m && !refs.has(m[0].trim())) refs.set(m[0].trim(), `${o.orgao} · ${b}`);
              }),
            );
            setEvidence({
              agent: 'ncm',
              titulo: `Classificação · NCM ${d.ncm}`,
              steps: [
                `Busquei "${text}" nas descrições oficiais da NCM vigente e cheguei ao ${d.ncm} — ${d.descricao_oficial}.`,
                d.caminho ? `Posição na nomenclatura: ${d.caminho}${d.descricao_oficial}.` : `Termos casados: ${d.termos_casados}.`,
                `Travessia do grafo: ${detalhe.length} órgão(s) anuente(s) e ${d.total_tratamentos} tratamento(s) administrativo(s).`,
                ...detalhe.slice(0, 5).map((o) => {
                  const tas = o.tratamentos.map((t) => t.ta_numero).filter(Boolean).slice(0, 4).join(', ');
                  return `${o.orgao}${o.orgao_nome ? ` (${o.orgao_nome})` : ''}: ${o.tratamentos.length} TA(s)${tas ? ` — ${tas}` : ''}${o.exige_lpco ? ' · EXIGE LPCO' : ''}${o.bases_legais[0] ? ` · ${o.bases_legais[0]}` : ''}.`;
                }),
                d.exige_lpco
                  ? '⚠️ Há exigência de LPCO: o licenciamento precisa estar deferido antes do registro da DUIMP.'
                  : 'Nenhum tratamento exige LPCO para este NCM neste snapshot.',
                `Método: ${d.metodo === 'graph_rag' ? 'Graph-RAG (candidatos do grafo + escolha por IA)' : 'busca no grafo'}. Confirme a incidência no Simulador do Portal Único.`,
              ],
              citations: [...refs.entries()].map(([ref, nota]) => ({ ref, nota })),
            });
          }

          const alts: { ncm: string; descricao: string }[] = d.alternativas ?? [];
          const linhas = [
            sourceLabel ?? '',
            `**NCM sugerida:** \`${d.ncm}\``,
            `**Descrição oficial:** ${d.descricao_oficial}`,
            d.caminho ? `**Posição na NCM:** ${d.caminho}${d.descricao_oficial}` : '',
            `**Órgãos anuentes:** ${orgaos.length ? orgaos.join(', ') : 'nenhum tratamento administrativo mapeado para este NCM'}`,
            d.justificativa ? `**Justificativa:** ${d.justificativa}` : '',
            `_Confiança: ${conf[d.confianca] ?? d.confianca} · ${d.metodo === 'graph_rag' ? 'Graph-RAG (grafo + IA)' : 'busca no grafo'} · termos ${d.termos_casados}_`,
            alts.length ? `_Alternativas: ${alts.map((a) => `${a.ncm} (${a.descricao})`).join(' · ')}_` : '',
          ];
          return linhas.filter(Boolean).join('\n\n');
        }

        if (d.success && !d.encontrado) {
          const termos: string[] = d.termos ?? [];
          return [sourceLabel ?? '', d.mensagem, `_Termos buscados: ${termos.join(', ') || '—'}_`]
            .filter(Boolean)
            .join('\n\n');
        }
      } catch {
        /* backend indisponível — segue para a heurística local */
      }
      return formatClassification(classifyProduct(text), sourceLabel);
    });

  const riskReply = (text: string, sourceLabel?: string) => runQuickReply(() => {
    const analysis = buildHeuristicAnalysis(text, customRules);
    const red = analysis.alerts.filter(a => a.severity === 'red');
    const yellow = analysis.alerts.filter(a => a.severity === 'yellow');
    const green = analysis.alerts.filter(a => a.severity === 'green');
    const line = (a: AuditAlert) => `• ${a.severity === 'red' ? '🔴' : a.severity === 'yellow' ? '🟡' : '🟢'} **${a.title}** — ${a.baseLegal}`;
    const body = [...red, ...yellow, ...green].map(line).join('\n') || 'Nenhum controle crítico identificado para os dados fornecidos.';
    return `${sourceLabel ? sourceLabel + '\n\n' : ''}**Leitura de risco aduaneiro** — score ${analysis.riskScore}% · ${red.length} bloqueio(s), ${yellow.length} atenção, ${green.length} oportunidade(s):\n\n${body}\n\nPara o parecer completo com impacto financeiro e plano de ação, rode a intenção **Auditar Invoice**.`;
  });

  // Dispatcher por intenção compartilhado por texto, arquivo, imagem e áudio
  const dispatchIntent = (text: string, intent: ChatIntent, sourceLabel?: string) => {
    if (intent === 'classify') classifyReply(text, sourceLabel);
    else if (intent === 'risk') riskReply(text, sourceLabel);
    else auditFromText(text);
  };

  /* ---------- Gatilhos multimodais ---------- */

  const handleSuggestion = (pill: SuggestionPill) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text: pill.label });
    runAudit(() => PRESET_SCENARIOS[pill.presetIndex]);
  };

  const handleSendText = (text: string, intent: ChatIntent) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text });
    dispatchIntent(text, intent);
  };

  const handleFile = (fileName: string, intent: ChatIntent, isImage: boolean) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text: fileName, variant: isImage ? 'image' : 'file' });

    if (intent === 'audit') {
      const lower = fileName.toLowerCase();
      let presetIndex = 0;
      if (lower.includes('stanley') || lower.includes('mug') || lower.includes('summit')) presetIndex = 1;
      else if (lower.includes('epoxy') || lower.includes('resin') || lower.includes('chem')) presetIndex = 2;
      else if (lower.includes('drone') || lower.includes('aero')) presetIndex = 3;
      runAudit(() => ({ ...PRESET_SCENARIOS[presetIndex], fileName, isCustomUpload: true }));
      return;
    }

    // Classify / Risk sobre o nome do arquivo ou "leitura" da imagem
    const sourceLabel = isImage
      ? '🖼️ Imagem analisada pela visão computacional do ComexPilot.'
      : `📎 Documento lido: ${fileName}`;
    dispatchIntent(fileName, intent, sourceLabel);
  };

  const handleMic = (intent: ChatIntent) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text: 'Mensagem de voz · 0:14', variant: 'audio' });

    // Intenções rápidas: transcreve e responde no chat
    if (intent !== 'audit') {
      setIsBusy(true);
      fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetName: 'comex_audio_1' })
      })
        .then((r) => r.json())
        .then((data) => {
          const transcript = data?.success ? data.transcript : 'gel facial hidratante de Aloe Vera, NCM 3304.99.90, Coreia do Sul';
          setIsBusy(false);
          dispatchIntent(transcript, intent, `🎙️ **Transcrição do áudio:** "${transcript}"`);
        })
        .catch(() => {
          setIsBusy(false);
          dispatchIntent('gel facial hidratante de Aloe Vera 3304.99.90', intent, '🎙️ Áudio processado pelo motor local.');
        });
      return;
    }

    // Auditoria completa via áudio → Workspace
    let voiceReply: string | undefined;
    runAudit(async () => {
      try {
        const response = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetName: 'comex_audio_1' })
        });
        const data = await response.json();
        if (data.success) {
          voiceReply = `**Transcrição do áudio:** "${data.transcript}"\n\n${data.analysis}`;
        }
      } catch (err) {
        console.error(err);
        voiceReply = 'Não consegui contatar o processador de voz — carreguei a auditoria do lote de cosméticos usando o motor local de regras.';
      }
      return PRESET_SCENARIOS[0];
    }, () => voiceReply);
  };

  const handleNewProcess = () => {
    if (isBusy) return;
    setMessages([WELCOME_MESSAGE]);
    setActiveAnalysis(null);
    setWorkspaceStatus('empty');
    setWorkspaceMode('audit');
  };

  /* ---------- Skill: Landed Cost ---------- */

  const openLandedCost = () => {
    setWorkspaceMode('landedCost');
    pushMessage({ role: 'assistant', text: 'Abri a skill **Custeio e Viabilidade (Landed Cost)** no canvas. Arraste uma Invoice ou cole os dados brutos no topo do formulário para eu pré-preencher os campos automaticamente.' });
  };

  const closeLandedCost = () => setWorkspaceMode('audit');

  /* ---------- Navegação por intenção (Home ⇄ Workspace) ---------- */

  const navigateHome = () => {
    if (isBusy) return;
    setView('home');
  };

  // Dica curta exibida no chat ao abrir uma consulta rápida vinda da Home
  const INTENT_HINTS: Partial<Record<ChatIntent, string>> = {
    classify: 'Skill **Classificar NCM** ativada. Descreva o produto, cole a linha da fatura ou envie uma foto — devolvo a NCM sugerida com órgão anuente e justificativa.',
    risk: 'Skill **Risco Aduaneiro** ativada. Descreva a operação (produto, NCM, origem) para eu calcular o score e listar bloqueios e oportunidades.'
  };

  // Abre uma tarefa da Home/NavRail mapeando o TaskId para a lógica existente
  const openTask = (taskId: TaskId) => {
    if (isBusy) return;

    if (taskId === 'compliance') {
      setWorkspaceMode('compliance');
      setView('workspace');
      return;
    }

    if (taskId === 'landedCost') {
      setView('workspace');
      openLandedCost();
      return;
    }

    // Intenções cobertas hoje pela barra de comando multimodal
    if (taskId === 'audit' || taskId === 'classify' || taskId === 'risk') {
      setChatIntent(taskId);
      setWorkspaceMode('audit');
      setView('workspace');
      const hint = INTENT_HINTS[taskId];
      if (hint) pushMessage({ role: 'assistant', text: hint });
      return;
    }

    // checklist, freight, margin, ncm, antidumping ainda não disponíveis:
    // a UI já as marca como "em breve" e bloqueia o clique, então isto é só
    // uma salvaguarda que não deveria ser alcançada.
  };

  // Barra de comando da Home: entra no workspace e despacha como auditoria
  const runHomeCommand = (command: string) => {
    if (isBusy) return;
    setChatIntent('audit');
    setWorkspaceMode('audit');
    setView('workspace');
    pushMessage({ role: 'user', text: command });
    dispatchIntent(command, 'audit');
  };

  /* ---------- Reatividade Workspace -> Chat ---------- */

  const buildAlertGuidance = (alert: AuditAlert) => {
    const header = alert.severity === 'green'
      ? 'Boa notícia — isso é uma **oportunidade tributária**, não um bloqueio. Roteiro para capturá-la no desembaraço:'
      : 'Roteiro técnico para regularizar esta exigência **antes do registro da DI**:';
    return `${header}\n\n**1. Ação imediata:** ${alert.planoAcao}\n\n**2. Fundamento legal:** ${alert.baseLegal}\n\n**3. Exposição se não tratado:** ${alert.impactoFinanceiro}\n\nSe quiser, estruturo a documentação automaticamente pelo botão do card correspondente.`;
  };

  const handleAlertInquire = (alert: AuditAlert) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text: `Como resolvo a exigência "${alert.title}"?` });
    setIsBusy(true);
    setTimeout(() => {
      pushMessage({ role: 'assistant', text: buildAlertGuidance(alert) });
      setIsBusy(false);
    }, 900);
  };

  /* ---------- Minuta de LI ---------- */

  const openLiMinuta = (item: InvoiceItem) => {
    const rule = findRuleForNcm(item.ncm, customRules);
    pushMessage({
      role: 'assistant',
      text: 'Done! 🚀 Minuta de LI estruturada para o Siscomex. O arquivo XML e o **Termo de Responsabilidade ANVISA** estão prontos para download.'
    });
    setLiPrefill({
      ncm: item.ncm,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      origin: item.countryOfOrigin,
      legalRule: rule?.requiresAnvisa
        ? 'RDC 752/2022 ANVISA (Controle Sanitário de Importação)'
        : 'Portaria SECEX nº 23/2011 (Licenciamento de Importação)',
      exporter: 'Seoul Beauty Laboratory Co.',
      manufacturer: 'S-Cosmetics Bio Factory Ltd.'
    });
  };

  /* ---------- Dock de agentes (OS Shell) ---------- */

  const onSelectAgent = (id: AgentId) => {
    if (isBusy) return;
    if (id === 'costing') return openTask('landedCost');
    if (id === 'ncm') return openTask('classify');
    if (id === 'compliance') { setWorkspaceMode('compliance'); setView('workspace'); return; }
    if (id === 'audit') return openTask('audit');
    if (id === 'chat') {
      setChatIntent('audit');
      setWorkspaceMode('audit');
      setView('workspace');
      return;
    }
    if (id === 'li') {
      setWorkspaceMode('audit');
      setView('workspace');
      pushMessage({ role: 'assistant', text: 'O **Gerador de LI** monta a minuta a partir de uma auditoria. Rode **Auditar documentos** e clique em *Gerar Minuta de LI* no bloqueio de anuência ANVISA.' });
      return;
    }
  };

  const activeAgent: AgentId | null =
    view === 'home' ? null
    : workspaceMode === 'landedCost' ? 'costing'
    : workspaceMode === 'compliance' ? 'compliance'
    : chatIntent === 'classify' ? 'ncm'
    : 'audit';

  // Item destacado na sidebar, derivado do estado do canvas.
  const activeTask: TaskId | null =
    view === 'home' ? null
    : workspaceMode === 'landedCost' ? 'landedCost'
    : workspaceMode === 'compliance' ? 'compliance'
    : chatIntent === 'classify' ? 'classify'
    : 'audit';

  // Abre um processo do Kanban carregando o agente responsável.
  const openProcess = (p: Processo) => onSelectAgent(p.agente);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white" id="comexpilot-app-root">

      <TopBar />

      <div className="flex min-h-0 flex-1">
      <NavRail activeView={view} onNavigateHome={navigateHome} onOpenTask={openTask} activeTask={activeTask} />

      {view === 'home' ? (
        <Home aiStatus={aiStatus} onOpenTask={openTask} onRunCommand={runHomeCommand} onOpenProcess={openProcess} />
      ) : (
        <>
          {/* Coluna do chat com colapso animado: largura controlada aqui, conteúdo com largura mínima fixa para não amassar durante a transição */}
          <div
            className={`h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
              isChatCollapsed ? 'w-0 min-w-0' : 'w-[40%] min-w-[380px]'
            }`}
            id="chat-column"
          >
            <div className="h-full min-w-[380px]">
              <ChatPanel
                messages={messages}
                isBusy={isBusy}
                thinking={workspaceStatus === 'loading' ? { steps: CHAT_THOUGHTS, index: stepIndex } : null}
                aiStatus={aiStatus}
                suggestions={SUGGESTIONS}
                intent={chatIntent}
                onIntentChange={setChatIntent}
                onSuggestion={handleSuggestion}
                onSendText={handleSendText}
                onMic={handleMic}
                onFile={handleFile}
              />
            </div>
          </div>

          {/* Toggle discreto na divisória chat / workspace */}
          <div className="relative z-20 w-0">
            <button
              onClick={() => setIsChatCollapsed((prev) => !prev)}
              title={isChatCollapsed ? 'Expandir painel de comando' : 'Recolher painel de comando'}
              className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-md transition hover:text-indigo-600 hover:shadow-lg"
              id="chat-collapse-toggle"
            >
              {isChatCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          <Workspace
            status={workspaceStatus}
            mode={workspaceMode}
            analysis={activeAnalysis}
            savingsBrl={activeAnalysis ? computeSavingsBrl(activeAnalysis.items, customRules) : 0}
            onGenerateLi={openLiMinuta}
            onAlertInquire={handleAlertInquire}
            onOpenLandedCost={openLandedCost}
            onCloseLandedCost={closeLandedCost}
          />
        </>
      )}
      <EvidencePanel />
      </div>

      <AgentDock active={activeAgent} onSelect={onSelectAgent} />

      {liPrefill && (
        <LiMinutaModal
          data={liPrefill}
          onClose={() => setLiPrefill(null)}
        />
      )}

    </div>
  );
}
