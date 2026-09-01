/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gera o contorno dos continentes para o mapa do Monitor de Frete.
 *
 * POR QUE PRÉ-GERAR: a alternativa seria embarcar o TopoJSON (55 KB) mais
 * d3-geo e topojson-client no bundle do cliente e projetar a cada render. Como
 * a projeção é fixa, o resultado é sempre o mesmo — então ele é calculado uma
 * vez aqui e vira uma string de path. O cliente não ganha dependência nenhuma.
 *
 * Fonte: world-atlas (Natural Earth, domínio público), resolução 1:110m.
 * São costas REAIS. A alternativa — desenhar continentes de memória — produziria
 * uma geografia inventada, que num produto de conformidade é inaceitável mesmo
 * como enfeite.
 *
 * Uso: npm run gen:mapa
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Janela do mapa: cobre da América do Sul (Manaus, -60°) à Ásia (Dalian, 122°),
 * que é o corredor inteiro da rate sheet, com folga para o contorno dos
 * continentes fechar.
 */
// Justa ao corredor real: Manaus (-60°) a Dalian (122°) em longitude,
// Montevidéu (-35°) a Tianjin (39°) em latitude, com margem para a costa fechar.
const JANELA = { lonMin: -72, lonMax: 134, latMin: -44, latMax: 48 };
const LARGURA = 1200;

// Equiretangular: x = escala * lonRad + tx. Uma escala fixa faz cada grau de
// longitude valer o mesmo número de pixels em toda a extensão.
const grausLon = JANELA.lonMax - JANELA.lonMin;
const escala = (LARGURA * 180) / (grausLon * Math.PI);
const tx = escala * ((-JANELA.lonMin * Math.PI) / 180);
const ty = escala * ((JANELA.latMax * Math.PI) / 180);
const ALTURA = Math.round(escala * (((JANELA.latMax - JANELA.latMin) * Math.PI) / 180));

const projecao = geoEquirectangular()
  .scale(escala)
  .translate([tx, ty])
  .clipExtent([[0, 0], [LARGURA, ALTURA]]);

const topo = JSON.parse(
  fs.readFileSync(path.join(RAIZ, 'node_modules', 'world-atlas', 'land-110m.json'), 'utf8'),
);
const terra = feature(topo, topo.objects.land);
const d = geoPath(projecao)(terra);

if (!d) throw new Error('projeção não produziu geometria');

const saida = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GERADO POR scripts/gen_world_path.mjs — NÃO EDITAR À MÃO.
 *
 * Contorno dos continentes (Natural Earth 1:110m, domínio público) já projetado
 * em equiretangular para a janela do Monitor de Frete. As constantes abaixo
 * posicionam portos e arcos na MESMA projeção, então tudo cai no lugar certo.
 */

export const MAPA = {
  largura: ${LARGURA},
  altura: ${ALTURA},
  lonMin: ${JANELA.lonMin},
  lonMax: ${JANELA.lonMax},
  latMin: ${JANELA.latMin},
  latMax: ${JANELA.latMax},
  escala: ${escala.toFixed(4)},
  tx: ${tx.toFixed(4)},
  ty: ${ty.toFixed(4)},
} as const;

/** Longitude (graus) -> x em pixels do viewBox. */
export const projX = (lon: number) => MAPA.escala * ((lon * Math.PI) / 180) + MAPA.tx;
/** Latitude (graus) -> y em pixels do viewBox. */
export const projY = (lat: number) => MAPA.ty - MAPA.escala * ((lat * Math.PI) / 180);

export const CAMINHO_TERRA = ${JSON.stringify(d)};
`;

const destino = path.join(RAIZ, 'src', 'components', 'freight', 'worldPath.ts');
fs.writeFileSync(destino, saida, 'utf8');

console.log(`viewBox   : ${LARGURA} x ${ALTURA}`);
console.log(`janela    : lon ${JANELA.lonMin}..${JANELA.lonMax} · lat ${JANELA.latMin}..${JANELA.latMax}`);
console.log(`path      : ${(d.length / 1024).toFixed(1)} KB`);
console.log(`saida     : ${destino}`);
