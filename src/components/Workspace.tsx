/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Roteador do canvas central. Cada item do menu lateral tem aqui o SEU
 * componente — nenhuma rota cai mais numa tela genérica de fallback.
 *
 *   audit       → AuditorWorkspace       (vazio) / AuditWorkspace (com veredito)
 *   classify    → NcmClassifierWorkspace
 *   compliance  → ComplianceWorkspace
 *   freight     → FreightWorkspace
 *   landedCost  → LandedCostDrawer
 *
 * O `status` só governa o modo 'audit', que é o único com ciclo de vida
 * (aguardando documento → processando → veredito). Os demais canvas buscam os
 * próprios dados e cuidam do próprio estado de carga.
 */

import React from 'react';
import LandedCostDrawer from './LandedCostDrawer';
import AuditWorkspace from './audit/AuditWorkspace';
import AuditorWorkspace from './audit/AuditorWorkspace';
import NcmClassifierWorkspace from './classify/NcmClassifierWorkspace';
import ComplianceWorkspace from './compliance/ComplianceWorkspace';
import FreightWorkspace from './freight/FreightWorkspace';
import type { ArquivoEnviado } from './ChatPanel';
import { AuditAlert, InvoiceAnalysis, InvoiceItem, WorkspaceMode, WorkspaceStatus } from '../types';

interface WorkspaceProps {
  status: WorkspaceStatus;
  mode: WorkspaceMode;
  analysis: InvoiceAnalysis | null;
  onGenerateLi: (item: InvoiceItem) => void;
  onAlertInquire: (alert: AuditAlert) => void;
  /** Dispara a auditoria com o texto de uma fatura de exemplo. */
  onExemploAuditoria: (texto: string) => void;
  /** Documento largado na dropzone do canvas de auditoria. */
  onArquivoAuditoria: (arquivo: ArquivoEnviado) => void;
  isBusy?: boolean;
  onCloseLandedCost: () => void;
  onExportarFrete: (d: { freteUsd: number; porto: string; rotulo: string }) => void;
  seedFrete?: { freteUsd: number; porto: string; rotulo: string } | null;
}

export default function Workspace({ status, mode, analysis, onGenerateLi, onAlertInquire, onExemploAuditoria, onArquivoAuditoria, isBusy, onCloseLandedCost, onExportarFrete, seedFrete }: WorkspaceProps) {
  // Skill densa ocupa o canvas por cima de qualquer estado de auditoria
  if (mode === 'landedCost') {
    return <LandedCostDrawer onClose={onCloseLandedCost} seedFrete={seedFrete} />;
  }

  if (mode === 'compliance') {
    return <ComplianceWorkspace onClose={onCloseLandedCost} />;
  }

  if (mode === 'freight') {
    return <FreightWorkspace onClose={onCloseLandedCost} onExportarParaCusteio={onExportarFrete} />;
  }

  if (mode === 'classify') {
    return <NcmClassifierWorkspace />;
  }

  /* ---------- EMPTY: canvas próprio de "Auditar Documentos" ---------- */
  // Antes aqui morava uma tela genérica ("Workspace de Auditoria — aguardando
  // documento") servida a QUALQUER modo sem conteúdo, com um card de skill
  // duplicando o menu lateral e um "Roteiro de Nacionalização · em breve" que
  // não abria nada. Agora o modo tem a sua tela, com dropzone e exemplos.
  if (status === 'empty') {
    return (
      <AuditorWorkspace
        onExemplo={onExemploAuditoria}
        onArquivo={onArquivoAuditoria}
        isBusy={isBusy}
      />
    );
  }

  /* ---------- LOADING: esqueleto elegante do veredito ---------- */
  if (status === 'loading') {
    return (
      <section className="h-full flex-1 overflow-y-auto bg-slate-100/60" id="workspace-loading">
        <div className="mx-auto max-w-4xl animate-pulse space-y-5 px-6 py-6">

          {/* File tab skeleton */}
          <div className="flex items-end justify-between">
            <div className="h-9 w-56 rounded-t-xl border border-b-0 border-slate-200 bg-white"></div>
            <div className="mb-2 h-3 w-40 rounded bg-slate-200/70"></div>
          </div>

          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-48 rounded-md bg-slate-200"></div>
              <div className="h-3 w-64 rounded bg-slate-200/70"></div>
            </div>
            <div className="h-7 w-28 rounded-full bg-slate-200"></div>
          </div>

          {/* Metrics skeleton */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="h-2.5 w-16 rounded bg-slate-200"></div>
                <div className="mt-3 h-5 w-20 rounded bg-slate-200"></div>
              </div>
            ))}
          </div>

          {/* Triage feed skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <div className="h-4 w-52 rounded bg-slate-200"></div>
            </div>
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-3/5 rounded bg-slate-200"></div>
                    <div className="h-4 w-16 rounded bg-slate-200/70"></div>
                  </div>
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <div className="h-3 w-full rounded bg-slate-200/70"></div>
                    <div className="h-3 w-11/12 rounded bg-slate-200/70"></div>
                    <div className="h-3 w-2/3 rounded bg-slate-200/70"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items table skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="space-y-2.5">
              <div className="h-3 w-full rounded bg-slate-200/70"></div>
              <div className="h-3 w-10/12 rounded bg-slate-200/70"></div>
            </div>
          </div>

        </div>
      </section>
    );
  }

  /* ---------- COMPLETE: o veredito ---------- */
  if (!analysis) return null;

  return <AuditWorkspace analysis={analysis} onGenerateLi={onGenerateLi} onAlertInquire={onAlertInquire} />;
}
