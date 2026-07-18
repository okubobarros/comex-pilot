/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Marca oficial do ComexPilot. Usa o arquivo de arte (public/logo.png),
 * recortado ao disco com fundo externo transparente e disco branco preenchido
 * para renderizar bem tanto em superfícies claras quanto na barra escura.
 */

import React from 'react';

interface LogoProps {
  className?: string;
  title?: string;
}

export default function Logo({ className, title = 'ComexPilot' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt={title}
      className={className}
      draggable={false}
      style={{ objectFit: 'contain' }}
    />
  );
}
