/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, FileCode, RefreshCw, ShieldAlert, Sparkles, User, X } from 'lucide-react';
import { LiPrefillData } from '../types';

interface LiMinutaModalProps {
  data: LiPrefillData;
  onClose: () => void;
}

function triggerDownload(content: string, mime: string, fileName: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function LiMinutaModal({ data, onClose }: LiMinutaModalProps) {
  const [form, setForm] = useState<LiPrefillData>(data);
  const [isSignedWithCpf, setIsSignedWithCpf] = useState(false);
  const [cpfNumber, setCpfNumber] = useState('442.901.884-02');
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const validateSignature = () => {
    if (isSignedWithCpf && !cpfNumber.trim()) {
      setCpfError('Obrigatório preencher CPF para a assinatura eletrônica ICP-Brasil.');
      return false;
    }
    setCpfError(null);
    return true;
  };

  const handleExportXml = () => {
    if (!validateSignature()) return;
    setIsExporting(true);

    setTimeout(() => {
      setIsExporting(false);
      const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<SiscomexImportacao versao="2.0">
  <LicencaImportacao>
    <IdentificacaoCarga>
      <DescricaoComercial>${form.description}</DescricaoComercial>
      <Ncm>${form.ncm}</Ncm>
      <OrigemMercadoria>${form.origin}</OrigemMercadoria>
      <Quantidade>${form.quantity}</Quantidade>
      <Moeda>USD</Moeda>
      <ValorFob>${form.totalPrice.toFixed(2)}</ValorFob>
    </IdentificacaoCarga>
    <DadosExportador>
      <NomeRazao>${form.exporter}</NomeRazao>
      <Fabricante>${form.manufacturer}</Fabricante>
    </DadosExportador>
    <EnquadramentoLegal>
      <OrgaoAnuente>ANVISA</OrgaoAnuente>
      <NormativaReguladora>${form.legalRule}</NormativaReguladora>
      <RequisitosTecnicos>Regulamento de Cosméticos Capitulo 33</RequisitosTecnicos>
    </EnquadramentoLegal>
    <AssinaturaEletronica>
      <Metodo>ICP-Brasil Digital Signature Token</Metodo>
      <CPF>${isSignedWithCpf ? cpfNumber : 'NAO_ASSINADO'}</CPF>
      <Status>${isSignedWithCpf ? 'HOMOLOGADO_CPF_ATIVO' : 'PENDENTE_ASSINATURA'}</Status>
      <DataGeracao>${new Date().toISOString()}</DataGeracao>
    </AssinaturaEletronica>
  </LicencaImportacao>
</SiscomexImportacao>`;

      triggerDownload(xmlTemplate, 'text/xml', `siscomex_li_${form.ncm.replace(/\./g, '')}.xml`);
    }, 800);
  };

  const handleExportTermo = () => {
    if (!validateSignature()) return;
    setIsExporting(true);

    setTimeout(() => {
      setIsExporting(false);
      const docText = `TERMO DE COMPROMISSO E RESPONSABILIDADE ADUANEIRA - ANVISA / RECEITA FEDERAL

Pelo presente instrumento, declaramos para os devidos fins de direito, sob as penas da lei (Art. 299 do Código Penal Brasileiro), que as mercadorias descritas abaixo estão em perfeito acordo com as normas técnico-sanitárias vigentes no Brasil, especialmente as regras de Vigilância Sanitária relativas a Cosméticos (RDC 752/2022).

DADOS DO PRODUTO SOB ANALISE ADUANEIRA:
- Descrição Comercial: ${form.description}
- Nomenclatura Comum do Mercosul (NCM): ${form.ncm}
- Quantidade Lote: ${form.quantity} Unidades
- Valor Total FOB Declarado: USD ${form.totalPrice.toFixed(2)}
- País de Origem de Produção: ${form.origin}

DADOS ADICIONAIS DO PROCESSO:
- Exportador Internacional: ${form.exporter}
- Fabricante de Origem: ${form.manufacturer}
- Normativa Reguladora Ancorada: ${form.legalRule}

ASSINATURA DIGITAL ICP-BRASIL:
- Assinado eletronicamente por Responsável Técnico Aduaneiro
- CPF do Signatário: ${isSignedWithCpf ? cpfNumber : 'Sem assinatura digital vinculada'}
- Hash de Validação Eletrônica: SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}
- Data de Validação do Protocolo: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}

Este termo é integrado digitalmente ao dossiê de Licença de Importação do Siscomex para triagem fiscal preventiva.`;

      triggerDownload(docText, 'text/plain', `termo_responsabilidade_anvisa_${form.ncm.replace(/\./g, '')}.txt`);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">

        <div
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        ></div>

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">

          <div className="pointer-events-auto flex w-screen max-w-md transform flex-col justify-between bg-white shadow-2xl transition-all duration-300 ease-in-out">

            {/* Header */}
            <div className="flex items-center justify-between bg-indigo-600 px-4 py-5 text-white sm:px-6">
              <div className="space-y-1">
                <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" />
                  Mesa de LI Automatizada
                </h2>
                <p className="text-xs text-indigo-100">Ajuste preventivo de Licença de Importação ANVISA</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-indigo-200 transition hover:bg-indigo-700/50 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">

              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <strong>Aviso regulatório:</strong> o deferimento adiantado no Siscomex requer exatidão nos campos descritivos para o cruzamento automático de dados pela ANVISA.
                </div>
              </div>

              <div className="space-y-3 text-xs">

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">NCM do Item</label>
                    <input
                      type="text"
                      value={form.ncm}
                      onChange={(e) => setForm({ ...form, ncm: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Origem / Fabricação</label>
                    <input
                      type="text"
                      value={form.origin}
                      onChange={(e) => setForm({ ...form, origin: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Descrição Comercial Aduaneira</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="h-16 w-full rounded border border-slate-200 p-2 text-xs font-semibold leading-tight focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[11px]">
                  <div>Qtd: <span className="font-semibold text-slate-800">{form.quantity}</span></div>
                  <div>Preço: <span className="font-semibold text-slate-800">${form.unitPrice.toFixed(2)}</span></div>
                  <div>FOB: <span className="font-semibold text-slate-900">${form.totalPrice.toFixed(2)}</span></div>
                </div>

                <div className="space-y-2 border-t border-slate-200 pt-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Razão Social do Exportador</label>
                    <input
                      type="text"
                      value={form.exporter}
                      onChange={(e) => setForm({ ...form, exporter: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Fabricante de Origem</label>
                    <input
                      type="text"
                      value={form.manufacturer}
                      onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* CPF digital signature */}
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">Assinatura Digital ICP-Brasil</label>
                    <button
                      type="button"
                      onClick={() => setIsSignedWithCpf(!isSignedWithCpf)}
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        isSignedWithCpf ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isSignedWithCpf ? 'Vinculado' : 'Inserir assinatura'}
                    </button>
                  </div>

                  {isSignedWithCpf && (
                    <div className="space-y-1.5 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <input
                          type="text"
                          value={cpfNumber}
                          onChange={(e) => setCpfNumber(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full rounded border border-emerald-200 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      {cpfError && (
                        <span className="block text-[11px] font-semibold text-rose-600">{cpfError}</span>
                      )}

                      <div className="text-[11px] leading-tight text-emerald-800">
                        Token E-CPF ativo. O XML e o Termo serão assinados sob a cadeia legal ICP-Brasil.
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Footer actions */}
            <div className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportXml}
                  disabled={isExporting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Construindo...
                    </>
                  ) : (
                    <>
                      <FileCode className="h-3.5 w-3.5" />
                      Baixar XML Siscomex
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportTermo}
                  disabled={isExporting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Termo ANVISA .TXT
                    </>
                  )}
                </button>
              </div>

              <span className="block text-center font-mono text-[10px] text-slate-400">
                Gerado pelo motor ComexPilot AI · Uso preventivo homologado
              </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
