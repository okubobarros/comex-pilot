/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Paperclip, ArrowUp, Check, Loader2, ImageIcon, FileText, ScanSearch, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import { ChatIntent, ChatMessage } from '../types';

export interface SuggestionPill {
  label: string;
  presetIndex: number;
}

export interface ThinkingState {
  steps: string[];
  index: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isBusy: boolean;
  /** Pensamentos do agente durante a auditoria; null exibe o indicador de digitação padrão */
  thinking: ThinkingState | null;
  aiStatus: 'idle' | 'success' | 'simulated';
  suggestions: SuggestionPill[];
  onSuggestion: (pill: SuggestionPill) => void;
  onSendText: (text: string, intent: ChatIntent) => void;
  onMic: (intent: ChatIntent) => void;
  onFile: (fileName: string, intent: ChatIntent, isImage: boolean) => void;
}

const INTENTS: { key: ChatIntent; label: string; icon: React.ReactNode }[] = [
  { key: 'audit', label: 'Auditar Invoice', icon: <FileText className="h-3.5 w-3.5" /> },
  { key: 'classify', label: 'Classificar NCM', icon: <ScanSearch className="h-3.5 w-3.5" /> },
  { key: 'risk', label: 'Risco Aduaneiro', icon: <ShieldCheck className="h-3.5 w-3.5" /> }
];

const PLACEHOLDERS: Record<ChatIntent, string> = {
  audit: 'Pergunte ao ComexPilot ou descreva a Invoice...',
  classify: 'Descreva o produto ou cole a linha da fatura para classificar a NCM...',
  risk: 'Descreva a operação para avaliar o risco aduaneiro...'
};

/** Renderiza **negrito** simples nas respostas do agente. */
function renderRich(text: string) {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-800">{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

const WAVE_BARS = [6, 12, 18, 10, 4, 16, 22, 14, 8, 18, 12, 6, 16, 10, 14];

export default function ChatPanel({ messages, isBusy, thinking, aiStatus, suggestions, onSuggestion, onSendText, onMic, onFile }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [intent, setIntent] = useState<ChatIntent>('audit');
  const feedRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isBusy, thinking?.index]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isBusy) return;
    setDraft('');
    onSendText(text, intent);
  };

  const isImageFile = (name: string) => /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(name);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file.name, intent, isImageFile(file.name));
  };

  return (
    <section className="flex h-full w-full flex-col border-r border-slate-200 bg-white" id="chat-panel">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight text-slate-900">Painel de Comando</h2>
          <p className="text-xs text-slate-400">Auditoria aduaneira conversacional</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          </span>
          <span className="font-mono uppercase tracking-wider">
            {aiStatus === 'simulated' ? 'Motor Local' : 'Gemini Ativo'}
          </span>
        </div>
      </div>

      {/* Message feed */}
      <div ref={feedRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" id="chat-feed">
        {messages.map((msg) => (
          msg.role === 'assistant' ? (
            <div key={msg.id} className="flex items-start gap-2.5">
              <Logo className="mt-0.5 h-7 w-7 shrink-0" />
              <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-600">
                {renderRich(msg.text)}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-900 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100">
                {msg.variant === 'audio' ? (
                  <div className="flex items-center gap-2">
                    <Mic className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <div className="flex h-5 items-center gap-0.5">
                      {WAVE_BARS.map((h, i) => (
                        <span key={i} style={{ height: `${h}px` }} className="w-[3px] rounded-full bg-slate-500"></span>
                      ))}
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">0:14</span>
                  </div>
                ) : msg.variant === 'file' ? (
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                    <span className="font-mono text-xs">{msg.text}</span>
                  </div>
                ) : msg.variant === 'image' ? (
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                    <span className="font-mono text-xs">{msg.text}</span>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          )
        ))}

        {isBusy && (
          <div className="flex items-start gap-2.5">
            <Logo className="mt-0.5 h-7 w-7 shrink-0" />
            {thinking ? (
              <div className="space-y-2.5 rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-3.5 py-3" id="agent-thoughts">
                {thinking.steps.slice(0, thinking.index + 1).map((step, i) => (
                  <div key={step} className="flex items-center gap-2 text-sm">
                    {i < thinking.index ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-500" />
                    )}
                    <span className={i < thinking.index ? 'text-slate-400' : 'text-slate-600'}>{step}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-3.5 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]"></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestion pills + command input */}
      <div className="border-t border-slate-200 px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestions.map((pill) => (
            <button
              key={pill.label}
              onClick={() => onSuggestion(pill)}
              disabled={isBusy}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40"
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Seletor de intenção multimodal (estilo Digicust) */}
        <div className="mb-2.5 flex flex-wrap gap-1.5" id="intent-selector">
          {INTENTS.map((it) => (
            <button
              key={it.key}
              onClick={() => setIntent(it.key)}
              disabled={isBusy}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                intent === it.key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex items-center gap-1.5 rounded-xl border p-1.5 transition ${
            dragOver ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-300 bg-white focus-within:border-slate-400'
          }`}
          id="command-input-bar"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file.name, intent, isImageFile(file.name));
              e.target.value = '';
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file.name, intent, true);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            title="Anexar Invoice, BL ou documento"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isBusy}
            title="Enviar foto do produto ou mercadoria"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <ImageIcon className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder={dragOver ? 'Solte o arquivo aqui...' : PLACEHOLDERS[intent]}
            disabled={isBusy}
            className="min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />

          <button
            onClick={() => onMic(intent)}
            disabled={isBusy}
            title="Simular áudio do despachante (WhatsApp)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={submit}
            disabled={isBusy || !draft.trim()}
            title="Enviar comando"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-700 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        {/* Selos de conformidade enterprise */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5" id="compliance-badges">
          {['SOC2 II', 'CCPA', 'ISO 27001', 'GDPR'].map((badge) => (
            <span
              key={badge}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-slate-400"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
