/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Marca do ComexPilot: puffin sobre ondas dentro de um disco azul→roxo,
 * recriação vetorial do logotipo oficial. Escala sem perda em qualquer tamanho.
 */

import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  title?: string;
}

export default function Logo({ className, title = 'ComexPilot' }: LogoProps) {
  // Ids únicos por instância evitam colisão de <defs> quando o logo aparece várias vezes
  const uid = useId().replace(/:/g, '');
  const gDisc = `disc-${uid}`;
  const gEye = `eye-${uid}`;
  const gBeakTop = `beakTop-${uid}`;
  const gBeakBottom = `beakBottom-${uid}`;
  const clip = `clip-${uid}`;

  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      <defs>
        <linearGradient id={gDisc} x1="70" y1="120" x2="452" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B57F0" />
          <stop offset="0.55" stopColor="#4B36D8" />
          <stop offset="1" stopColor="#6C29D8" />
        </linearGradient>
        <linearGradient id={gEye} x1="228" y1="188" x2="266" y2="228" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8A5CFF" />
          <stop offset="1" stopColor="#4B41E6" />
        </linearGradient>
        <linearGradient id={gBeakTop} x1="372" y1="150" x2="472" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FBA83A" />
          <stop offset="1" stopColor="#F8791C" />
        </linearGradient>
        <linearGradient id={gBeakBottom} x1="392" y1="288" x2="462" y2="352" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F8791C" />
          <stop offset="1" stopColor="#EC4A1B" />
        </linearGradient>
        <clipPath id={clip}>
          <circle cx="256" cy="256" r="238" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        {/* Disco */}
        <circle cx="256" cy="256" r="238" fill={`url(#${gDisc})`} />

        {/* Cabeça do puffin (espaço branco), deixando a lua crescente à esquerda */}
        <circle cx="300" cy="232" r="170" fill="#FFFFFF" />

        {/* Corpo d'água: onda colorida cobrindo a base */}
        <path
          d="M 18 366 C 110 336 190 356 286 368 C 372 378 430 360 494 350 L 494 512 L 18 512 Z"
          fill={`url(#${gDisc})`}
        />

        {/* Ondas brancas */}
        <path
          d="M 40 410 C 140 384 220 402 310 414 C 388 424 442 410 486 400"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 70 462 C 160 440 240 456 322 466 C 394 474 440 464 476 456"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="15"
          strokeLinecap="round"
        />

        {/* Bico laranja (mandíbula superior e inferior, com fenda branca) */}
        <path
          d="M 366 150 C 416 150 456 188 478 236 C 452 246 420 250 392 252 C 384 218 374 184 366 150 Z"
          fill={`url(#${gBeakTop})`}
        />
        <path
          d="M 392 288 C 428 292 456 312 470 342 C 442 356 414 356 394 350 C 388 330 388 308 392 288 Z"
          fill={`url(#${gBeakBottom})`}
        />

        {/* Olho */}
        <circle cx="246" cy="206" r="25" fill={`url(#${gEye})`} />
      </g>
    </svg>
  );
}
