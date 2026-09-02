/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canvas de "Auditar Documentos" antes de existir um documento.
 *
 * Antes esta rota caía na tela genérica "Workspace de Auditoria — aguardando
 * documento", a mesma servida a qualquer modo sem conteúdo: o usuário clicava
 * num item do menu e não recebia nada específico dele.
 *
 * HONESTIDADE DE FORMATOS
 * -----------------------
 * A dropzone anuncia apenas o que o app realmente lê no navegador (.txt, .csv,
 * .tsv, .json, .xml, .md, .edi). PDF e imagem NÃO são extraídos aqui — quem
 * larga um .pdf recebe um aviso pedindo o texto colado. Prometer ".pdf, .png"
 * na dropzone produziria uma falha imediata no primeiro uso, então o limite
 * fica escrito antes do upload, não depois.
 *
 * A prévia da auditoria lista as verificações que o motor executa de fato
 * (`src/engine/rulesEngine.ts`), na ordem em que aparecem no veredito. Nada de
 * campo decorativo: cada card corresponde a um alerta que pode ser emitido.
 */
import React, { useRef, useState } from 'react';
import {
  ArrowRight, BadgeCheck, FileSearch, FileUp, Loader2, ScanLine,
  ShieldAlert, Sparkles, TrendingUp, Upload,
} from 'lucide-react';
import { EXEMPLOS_INVOICE } from '../../data/exemplosInvoice';
import type { ArquivoEnviado } from '../ChatPanel';

interface AuditorWorkspaceProps {
  /** Dispara a esteira de auditoria com o texto de um exemplo. */
  onExemplo: (texto: string) => void;
  /** Mesma entrada do anexo do copiloto — o App decide o que fazer. */
  onArquivo: (arquivo: ArquivoEnviado) => void;
  isBusy?: boolean;
}

/** Extensões que o navegador consegue ler sem backend de OCR. */
const LEGIVEL = /\.(txt|csv|tsv|json|xml|md|edi)$/i;
const IMAGEM = /\.(png|jpe?g|gif|webp|heic|bmp)$/i;

/**
 * O que a auditoria verifica. Cada item existe em `rulesEngine.ts` — a prévia
 * é um índice do que vai rodar, não uma promessa de produto.
 */
const VERIFICACOES = [
  {
    icon: <ScanLine className="h-4 w-4" />,
    titulo: 'Divergência de NCM',
    texto: 'A NCM declarada em cada linha é confrontada com a que a descrição da mercadoria sustenta.',
    cor: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  },
  {
    icon: <TrendingUp className="h-4 w-4" />,
    titulo: 'Valor aduaneiro e moeda',
    texto: 'Preço unitário abaixo do valor de referência da NCM — exposição a subfaturamento e canal cinza.',
    cor: 'text-rose-600 bg-rose-50 border-rose-100',
  },
  {
    icon: <ShieldAlert className="h-4 w-4" />,
    titulo: 'Anuência e homologação',
    texto: 'Licenciamento prévio de ANVISA, MAPA e ANATEL, incluindo conflito de competência entre órgãos.',
    cor: 'text-amber-600 bg-amber-50 border-amber-100',
  },
  {
    icon: <BadgeCheck className="h-4 w-4" />,
    titulo: 'Antidumping e oportunidades',
    texto: 'Direito antidumping vigente por origem, ex-tarifário aplicável e desoneração de PIS/COFINS.',
    cor: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
];

export default function AuditorWorkspace({ onExemplo, onArquivo, isBusy }: AuditorWorkspaceProps) {
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const receber = async (file: File | undefined) => {
    if (!file) return;
    const isImage = IMAGEM.test(file.name);
    let texto: string | null = null;
    if (!isImage && LEGIVEL.test(file.name)) {
      try { texto = await file.text(); } catch { texto = null; }
    }
    onArquivo({ nome: file.name, texto, isImage });
  };

  return (
    <section className="h-full flex-1 overflow-y-auto bg-slate-50" id="auditor-workspace">
      <div className="mx-auto max-w-3xl px-6 py-6">

        {/* Barra de título */}
        {/* O canvas divide a largura com o copiloto e encolhe mais ainda quando
            o menu lateral expande no hover. Sem `flex-wrap` + `basis`, o título
            era espremido em cinco linhas para o botão caber ao lado. */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">
                Auditoria Inteligente de Invoices &amp; BLs
              </h2>
              <p className="text-sm text-slate-400">
                Extrai os itens do documento e cruza cada NCM com as regras de anuência, preço e antidumping
              </p>
            </div>
          </div>
          <button
            onClick={() => onExemplo(EXEMPLOS_INVOICE[0].texto)}
            disabled={isBusy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Carregar exemplo
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            void receber(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
            arrastando
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
          }`}
          id="auditor-dropzone"
        >
          <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl transition ${
            arrastando ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
          }`}>
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Arraste a Invoice ou o BL aqui, ou clique para selecionar
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Leio .txt, .csv, .tsv, .json, .xml, .md e .edi
          </p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">
            PDF e imagem ainda não são extraídos automaticamente — abra o documento e cole o texto
            no copiloto ao lado que a auditoria roda igual.
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".txt,.csv,.tsv,.json,.xml,.md,.edi,.png,.jpg,.jpeg"
            onChange={(e) => { void receber(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>

        {/* Demonstrações rápidas */}
        <div className="mt-6">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Ou teste com uma fatura de exemplo
          </p>
          {/* Uma coluna: o canvas divide a tela com o copiloto e, em duas
              colunas, "Invoice de garrafas térmicas (China)" era truncado. */}
          <div className="grid gap-2">
            {EXEMPLOS_INVOICE.map((ex) => (
              <button
                key={ex.label}
                onClick={() => onExemplo(ex.texto)}
                disabled={isBusy}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:shadow-sm disabled:opacity-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-indigo-600 group-hover:text-white">
                  <FileUp className="h-4 w-4" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{ex.label}</span>
                  <span className="block truncate text-xs text-slate-400">{ex.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
        </div>

        {/* Prévia do que será verificado */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">O que a auditoria verifica</h3>
            <p className="text-xs text-slate-400">
              Cada linha do documento passa por estas checagens e vira um alerta classificado por severidade
            </p>
          </div>
          <div className="grid gap-px bg-slate-100">
            {VERIFICACOES.map((v) => (
              <div key={v.titulo} className="bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${v.cor}`}>
                    {v.icon}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{v.titulo}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{v.texto}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Frete e Incoterm não entram aqui: o custo da rota é comparado em <strong className="font-semibold text-slate-500">Cotação
            de Frete</strong> e entra no <strong className="font-semibold text-slate-500">Custo de Importação</strong>.
          </p>
        </div>

      </div>
    </section>
  );
}
