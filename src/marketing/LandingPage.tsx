/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Landing page institucional — a rota `/` de comexpilot.com.
 *
 * O QUE ESTA PÁGINA PODE PROMETER
 * -------------------------------
 * Marketing exagera; software de conformidade não pode. Cada capacidade
 * descrita aqui existe no produto e é alcançável em três cliques a partir do
 * botão de entrada:
 *
 *   Auditoria      → `rulesEngine.ts` (preço de referência, antidumping,
 *                     anuência ANVISA/MAPA/ANATEL, ex-tarifário, PIS/COFINS)
 *   LPCO / grafo   → `/api/sat-graph/ncm/:code` sobre o Neo4j de produção
 *   Landed cost    → `engine/costing.ts` (II, IPI, PIS, COFINS, AFRMM, ICMS)
 *
 * Duas coisas que a especificação pedia e que NÃO estão escritas na página:
 *
 *  1. "Leitura visual de PDFs" — o app não extrai PDF nem imagem. Prometer
 *     isso numa página pública gera a decepção no primeiro upload, e a
 *     dropzone do produto diz o contrário. O texto lista os formatos reais.
 *  2. Números de clientes, volume auditado ou economia média. Não temos
 *     medição para sustentar nenhum, e prova social inventada é o tipo de
 *     alegação que se vira contra quem vende conformidade.
 *
 * O cartão do hero é um exemplo ILUSTRATIVO e está rotulado como tal — não é
 * o resultado de uma auditoria real de cliente.
 */
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Calculator, CheckCircle2, Clock,
  FileSearch, Gavel, Lock, Network, PlayCircle, ShieldAlert, Zap,
} from 'lucide-react';
import Logo from '../components/Logo';
import LaunchAppButton from './LaunchAppButton';

const MENU = [
  { href: '#modulos', label: 'Módulos' },
  { href: '#solucoes', label: 'Soluções' },
  { href: '#beneficios', label: 'Benefícios' },
];

const DORES = [
  {
    icon: <ShieldAlert className="h-5 w-5" />,
    titulo: 'Multa e canal vermelho',
    texto:
      'Classificação fiscal incorreta ou LPCO errado levam a reclassificação de ofício, '
      + 'retenção da carga e multa sobre a diferença apurada.',
    tom: 'text-rose-400 bg-rose-500/10 ring-rose-500/20',
  },
  {
    icon: <Gavel className="h-5 w-5" />,
    titulo: 'Norma que muda sem aviso',
    texto:
      'Uma Instrução Normativa extingue uma anuência e a planilha não sabe. É o caso dos pneus '
      + 'novos: a IN IBAMA 9/2021 acabou com a LI prévia, mas a obrigação de destinação continua.',
    tom: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
  },
  {
    icon: <Clock className="h-5 w-5" />,
    titulo: 'Conferência manual',
    texto:
      'Horas batendo item a item entre invoice, packing list e conhecimento de embarque — '
      + 'justamente onde o erro passa despercebido.',
    tom: 'text-sky-400 bg-sky-500/10 ring-sky-500/20',
  },
];

const MODULOS = [
  {
    icon: <FileSearch className="h-6 w-6" />,
    titulo: 'Auditoria de documentos',
    texto:
      'Extrai os itens da invoice e confronta cada linha: NCM declarada contra a descrição, '
      + 'preço unitário contra o valor de referência, e origem contra os direitos antidumping vigentes.',
    itens: ['Divergência de NCM', 'Subfaturamento e canal cinza', 'Antidumping por origem'],
  },
  {
    icon: <Network className="h-6 w-6" />,
    titulo: 'Verificador de LPCO',
    texto:
      'Diz quem precisa autorizar a importação daquele NCM, o número do tratamento administrativo, '
      + 'a base legal citada por inteiro e o que permanece como obrigação depois do despacho.',
    itens: ['Órgão anuente e tipo de TA', 'Base legal completa e clicável', 'Obrigação pós-despacho'],
  },
  {
    icon: <Calculator className="h-6 w-6" />,
    titulo: 'Landed cost e frete',
    texto:
      'Calcula II, IPI, PIS, COFINS, AFRMM, Siscomex e o ICMS por dentro da UF de desembaraço, '
      + 'com o frete marítimo comparado entre armadores e levado direto para o custeio.',
    itens: ['Custo nacionalizado por item', 'Comparação de cenário A/B', 'Frete real por rota'],
  },
];

const BENEFICIOS = [
  { titulo: 'Cada resposta com a norma junto', texto: 'Toda exigência exibida traz o dispositivo que a sustenta — copiável direto para o espelho da DI/Duimp.' },
  { titulo: 'Sem dado inventado', texto: 'Quando a base não tem a informação, a tela diz que não tem. Nada de alíquota plausível preenchendo lacuna.' },
  { titulo: 'Grafo normativo, não busca em PDF', texto: 'As regras vivem num grafo consultável, então a cadeia NCM inteira aparece — não só o item folha, que costuma ser “Outros”.' },
  { titulo: 'Entra e usa', texto: 'Sem formulário, sem cartão, sem espera por liberação de acesso.' },
];

export default function LandingPage() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  const irPara = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] font-sans text-slate-300 antialiased selection:bg-emerald-500 selection:text-slate-950">

      {/* ---------------- A. HEADER ---------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          rolou ? 'border-b border-slate-800/80 bg-[#0a0f1d]/90 backdrop-blur-md' : 'border-b border-transparent'
        }`}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="/" className="flex shrink-0 items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-semibold tracking-tight text-white">ComexPilot</span>
          </a>

          <div className="hidden items-center gap-7 md:flex">
            {MENU.map((m) => (
              <a
                key={m.href}
                href={m.href}
                onClick={(e) => irPara(e, m.href)}
                className="text-sm font-medium text-slate-400 transition hover:text-white"
              >
                {m.label}
              </a>
            ))}
          </div>

          <LaunchAppButton label="Acessar plataforma" variante="discreto" className="shrink-0" />
        </nav>
      </header>

      {/* ---------------- B. HERO ---------------- */}
      <section className="relative overflow-hidden px-5 pb-20 pt-32 sm:px-8 sm:pt-36">
        {/*
          Brilho de fundo. O degradê já tem transição suave até transparente,
          então NÃO leva `blur`: um filtro de 120px sobre 900x520 cria uma
          camada de composição enorme, cara em máquina fraca e capaz de deixar
          o restante da página sem pintar. Mesmo efeito, sem o custo.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 opacity-30"
          style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.55) 0%, rgba(15,118,110,0.28) 35%, rgba(10,15,29,0) 70%)' }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <Zap className="h-3.5 w-3.5" />
              Novo: inteligência regulatória e verificador de LPCO
            </span>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              Inteligência artificial e conformidade aduaneira{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                em tempo real
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Audite invoices e BLs, verifique a exigência de LPCO e anuência de INMETRO, IBAMA e ANVISA,
              e simule o custo nacionalizado — com a norma que sustenta cada resposta ao lado dela.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LaunchAppButton label="Testar copiloto agora" className="w-full sm:w-auto" />
              <a
                href="#modulos"
                onClick={(e) => irPara(e, '#modulos')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-6 py-3.5 font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
              >
                <PlayCircle className="h-5 w-5" />
                Ver os módulos
              </a>
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Sem cadastro e sem cartão — a plataforma abre direto.
            </p>
          </div>

          {/* Cartão do produto — exemplo ilustrativo, rotulado como tal */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileSearch className="h-4 w-4 text-emerald-400" />
                  Invoice #8849
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  Auditoria concluída
                </span>
              </div>

              <dl className="space-y-3 py-4 text-sm">
                {[
                  { rotulo: 'Divergências de NCM', valor: 'nenhuma', ok: true },
                  { rotulo: 'Valor aduaneiro', valor: 'acima da referência', ok: true },
                  { rotulo: 'IBAMA · pneus novos', valor: 'sem LI prévia', ok: true },
                  { rotulo: 'INMETRO', valor: 'exige LPCO', ok: false },
                ].map((linha) => (
                  <div key={linha.rotulo} className="flex items-center justify-between gap-3">
                    <dt className="text-slate-400">{linha.rotulo}</dt>
                    <dd className={`flex items-center gap-1.5 font-medium ${linha.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {linha.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {linha.valor}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Base legal</p>
                <p className="mt-1 font-mono text-xs leading-relaxed text-slate-300">
                  IN IBAMA 9/2021, art. 25 — anuência prévia extinta; obrigação de destinação mantida.
                </p>
              </div>
            </div>

            <p className="mt-2.5 text-center text-[11px] text-slate-600">
              Exemplo ilustrativo da interface — não é a auditoria de um cliente.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- C. DORES ---------------- */}
      <section id="solucoes" className="border-t border-slate-900 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-500">O problema</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            O erro caro raramente é o difícil — é o que ninguém conferiu.
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {DORES.map((d) => (
              <div
                key={d.titulo}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition duration-200 hover:border-slate-700 hover:bg-slate-900/70"
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${d.tom}`}>
                  {d.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{d.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- D. MÓDULOS ---------------- */}
      <section id="modulos" className="border-t border-slate-900 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-500">A plataforma</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Três módulos que conversam entre si.
          </h2>
          <p className="mt-4 max-w-2xl text-slate-400">
            O frete cotado entra no custeio; o NCM classificado abre o verificador de anuência. Nada é
            redigitado de uma tela para a outra.
          </p>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {MODULOS.map((m) => (
              <div
                key={m.titulo}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/70 to-slate-900/20 p-6 transition duration-200 hover:border-emerald-500/40"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 transition group-hover:bg-emerald-500/20">
                  {m.icon}
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-white">{m.titulo}</h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate-400">{m.texto}</p>
                <ul className="mt-5 space-y-2 border-t border-slate-800 pt-4">
                  {m.itens.map((i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- E. BENEFÍCIOS ---------------- */}
      <section id="beneficios" className="border-t border-slate-900 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-500">Por que confiar</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Uma resposta sem fonte não vale numa fiscalização.
          </h2>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {BENEFICIOS.map((b) => (
              <div key={b.titulo} className="flex gap-4">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">{b.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{b.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- F. CTA FINAL ---------------- */}
      <section className="px-5 py-20 sm:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 to-[#0a0f1d] px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 opacity-25"
            style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0) 70%)' }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Sua operação aduaneira mais ágil e segura em menos de 30 segundos.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Sem formulário longo, sem cartão de crédito e sem login para começar.
            </p>
            <div className="mt-9 flex justify-center">
              <LaunchAppButton label="Entrar no dashboard e experimentar" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- G. FOOTER ---------------- */}
      <footer className="border-t border-slate-900 px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="font-display text-base font-semibold text-white">ComexPilot</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Conformidade aduaneira assistida por IA, com a norma citada em cada resposta.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              Documentos processados apenas durante a análise
            </span>
          </div>

          <div className="flex flex-wrap gap-x-14 gap-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Plataforma</p>
              <ul className="mt-3 space-y-2 text-sm">
                {MENU.map((m) => (
                  <li key={m.href}>
                    <a href={m.href} onClick={(e) => irPara(e, m.href)} className="text-slate-400 transition hover:text-white">
                      {m.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/app" className="inline-flex items-center gap-1 text-slate-400 transition hover:text-white">
                    Acessar <ArrowRight className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contato</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="mailto:contato@comexpilot.com" className="text-slate-400 transition hover:text-white">
                    contato@comexpilot.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-6xl border-t border-slate-900 pt-6">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} ComexPilot. As informações da plataforma apoiam a decisão do
            operador e não substituem a consulta à norma vigente nem o parecer do despachante responsável.
          </p>
        </div>
      </footer>
    </div>
  );
}
