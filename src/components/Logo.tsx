/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Marca do ComexPilot: puffin sobre ondas dentro de um disco azul→roxo,
 * recriação vetorial fiel do logotipo oficial. Escala sem perda.
 */

import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  title?: string;
}

export default function Logo({ className, title = 'ComexPilot' }: LogoProps) {
  // Ids únicos por instância evitam colisão de <defs> quando o logo se repete
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
        <linearGradient id={gDisc} x1="90" y1="440" x2="430" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3D5CF3" />
          <stop offset="0.5" stopColor="#4A39D9" />
          <stop offset="1" stopColor="#6E27D8" />
        </linearGradient>
        <linearGradient id={gEye} x1="228" y1="186" x2="268" y2="228" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8A5CFF" />
          <stop offset="1" stopColor="#4A34E8" />
        </linearGradient>
        <linearGradient id={gBeakTop} x1="372" y1="130" x2="486" y2="244" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FBA637" />
          <stop offset="1" stopColor="#F6731E" />
        </linearGradient>
        <linearGradient id={gBeakBottom} x1="392" y1="296" x2="470" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F5701C" />
          <stop offset="1" stopColor="#EE4A1C" />
        </linearGradient>
        <clipPath id={clip}>
          <circle cx="256" cy="256" r="246" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        {/* Disco */}
        <circle cx="256" cy="256" r="246" fill={`url(#${gDisc})`} />

        {/* Cabeça do puffin (branco), deixando a lua crescente azul à esquerda */}
        <circle cx="296" cy="236" r="170" fill="#FFFFFF" />

        {/* Água: onda colorida cobrindo a base, varrendo para cima à direita */}
        <path
          d="M 6 356 C 120 334 210 354 300 356 C 372 358 430 336 504 322 L 504 520 L 6 520 Z"
          fill={`url(#${gDisc})`}
        />

        {/* Ondas brancas em camadas */}
        <g fill="none" stroke="#FFFFFF" strokeLinecap="round">
          <path d="M 44 388 C 150 366 246 384 336 388 C 406 391 452 372 498 344" strokeWidth="16" />
          <path d="M 60 436 C 165 416 250 432 336 438 C 404 443 448 428 494 402" strokeWidth="16" />
          <path d="M 150 480 C 230 466 300 476 366 480 C 410 483 440 474 470 462" strokeWidth="13" />
        </g>

        {/* Bico laranja: mandíbula superior e inferior, com a fenda branca da boca */}
        <path
          d="M 372 150 C 384 108 402 78 424 66 C 452 96 480 150 494 208 C 470 224 430 236 388 244 C 382 212 376 180 372 150 Z"
          fill={`url(#${gBeakTop})`}
        />
        <path
          d="M 392 296 C 430 300 466 318 484 348 C 456 366 420 366 396 356 C 388 338 388 314 392 296 Z"
          fill={`url(#${gBeakBottom})`}
        />

        {/* Olho */}
        <circle cx="244" cy="205" r="25" fill={`url(#${gEye})`} />
      </g>
    </svg>
  );
}
