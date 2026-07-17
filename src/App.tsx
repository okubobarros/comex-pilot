/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AuditAlert, ChatMessage, InvoiceAnalysis, InvoiceItem, LiPrefillData, NcmRule, WorkspaceStatus } from './types';
import { DEFAULT_NCM_RULES, PRESET_SCENARIOS } from './data/mockScenarios';
import { buildHeuristicAnalysis, computeAlerts, computeSavingsBrl, findRuleForNcm } from './engine/rulesEngine';
import NavRail from './components/NavRail';
import ChatPanel, { SuggestionPill } from './components/ChatPanel';
import Workspace from './components/Workspace';
import LiMinutaModal from './components/LiMinutaModal';

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

  /* ---------- Gatilhos da jornada ---------- */

  const handleSuggestion = (pill: SuggestionPill) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text: pill.label });
    runAudit(() => PRESET_SCENARIOS[pill.presetIndex]);
  };

  const handleFile = (fileName: string) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text: fileName, variant: 'file' });

    const lower = fileName.toLowerCase();
    let presetIndex = 0;
    if (lower.includes('stanley') || lower.includes('mug') || lower.includes('summit')) presetIndex = 1;
    else if (lower.includes('epoxy') || lower.includes('resin') || lower.includes('chem')) presetIndex = 2;
    else if (lower.includes('drone') || lower.includes('aero')) presetIndex = 3;

    runAudit(() => ({ ...PRESET_SCENARIOS[presetIndex], fileName, isCustomUpload: true }));
  };

  const handleSendText = (text: string) => {
    if (isBusy) return;
    pushMessage({ role: 'user', text });

    runAudit(async () => {
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
  };

  const handleMic = () => {
    if (isBusy) return;
    pushMessage({ role: 'user', text: 'Mensagem de voz · 0:14', variant: 'audio' });

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white" id="comexpilot-app-root">

      <NavRail onNewProcess={handleNewProcess} />

      <ChatPanel
        messages={messages}
        isBusy={isBusy}
        thinking={workspaceStatus === 'loading' ? { steps: CHAT_THOUGHTS, index: stepIndex } : null}
        aiStatus={aiStatus}
        suggestions={SUGGESTIONS}
        onSuggestion={handleSuggestion}
        onSendText={handleSendText}
        onMic={handleMic}
        onFile={handleFile}
      />

      <Workspace
        status={workspaceStatus}
        analysis={activeAnalysis}
        savingsBrl={activeAnalysis ? computeSavingsBrl(activeAnalysis.items, customRules) : 0}
        onGenerateLi={openLiMinuta}
        onAlertInquire={handleAlertInquire}
      />

      {liPrefill && (
        <LiMinutaModal
          data={liPrefill}
          onClose={() => setLiPrefill(null)}
        />
      )}

    </div>
  );
}
