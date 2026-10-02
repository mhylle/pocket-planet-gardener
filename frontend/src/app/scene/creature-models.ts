import * as THREE from 'three';
import { leaning, merge, part } from './low-poly';

/*
 * The cosy low-poly creatures (D-8), built from three.js primitives like the garden models.
 * Units are steps; y is up and 0 is the ground, and each creature faces +z. Walkers reach a
 * little below the ground, so they meet the faceted planet without a gap; flyers are built
 * standing too, and the creature layer lifts them.
 */

const ball = (radius: number) => new THREE.SphereGeometry(radius, 7, 5);
const gem = (radius: number) => new THREE.IcosahedronGeometry(radius, 0);
const rod = (top: number, bottom: number, height: number, sides = 6) =>
  new THREE.CylinderGeometry(top, bottom, height, sides);
const cone = (radius: number, height: number, sides = 6) =>
  new THREE.ConeGeometry(radius, height, sides);
const dome = (radius: number) =>
  new THREE.SphereGeometry(radius, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const ring = (radius: number, tube: number) => new THREE.TorusGeometry(radius, tube, 4, 10);

const EYE = '#2b2324';

/** A pair of little eyes, either side of the middle at height y and depth z. */
const eyes = (spread: number, y: number, z: number, colour = EYE, size = 0.025) =>
  [-1, 1].map((side) => part(gem(size), colour, { at: [side * spread, y, z] }));

const SPECIES: Record<string, () => THREE.BufferGeometry[]> = {
  worm: () => [
    ...[0, 1, 2, 3, 4].map((i) =>
      part(ball(0.1), i % 2 ? '#e39591' : '#eaa39f', {
        at: [0.04 * Math.sin(i * 1.4), 0.08, -0.3 + i * 0.13],
      }),
    ),
    part(ball(0.12), '#efaeaa', { at: [0, 0.12, 0.36] }),
    ...eyes(0.05, 0.17, 0.45),
  ],
  snail: () => [
    part(ball(0.14), '#d8c7a0', { at: [0, 0.06, 0.05], size: [1, 0.55, 2.4] }),
    part(ball(0.09), '#dccca6', { at: [0, 0.13, 0.33] }),
    ...[-1, 1].flatMap((side) => {
      const [tilt, spin, length] = [0.35, side * 0.5, 0.16];
      const base: [number, number, number] = [side * 0.03, 0.18, 0.36];
      const tip: [number, number, number] = [
        base[0] + length * Math.sin(tilt) * Math.sin(spin),
        base[1] + length * Math.cos(tilt),
        base[2] + length * Math.sin(tilt) * Math.cos(spin),
      ];
      return [
        leaning(rod(0.012, 0.012, length, 4), '#cdb98f', length, tilt, spin, base),
        part(gem(0.028), EYE, { at: tip }),
      ];
    }),
    // The shell, with its spiral showing on either side.
    part(ball(0.2), '#b8743f', { at: [0, 0.26, -0.06] }),
    ...[-1, 1].flatMap((side) => [
      part(ring(0.1, 0.03), '#8f5530', {
        at: [side * 0.15, 0.27, -0.06],
        turn: [0, Math.PI / 2, 0],
      }),
      part(gem(0.04), '#8f5530', { at: [side * 0.19, 0.27, -0.06] }),
    ]),
  ],
  bee: () => [
    part(ball(0.16), '#ffc83d', { at: [0, 0.17, 0], size: [1, 0.95, 1.35] }),
    ...[
      [-0.06, 0.16],
      [0.08, 0.155],
    ].map(([z, radius]) =>
      part(rod(radius, radius, 0.05, 8), '#3b2f2f', {
        at: [0, 0.17, z],
        turn: [Math.PI / 2, 0, 0],
      }),
    ),
    part(cone(0.03, 0.08, 4), '#3b2f2f', { at: [0, 0.16, -0.25], turn: [-Math.PI / 2, 0, 0] }),
    part(ball(0.1), '#3b2f2f', { at: [0, 0.2, 0.25] }),
    ...eyes(0.05, 0.24, 0.32, '#ffffff'),
    ...[-1, 1].map((side) =>
      part(ball(0.12), '#eef6ff', {
        at: [side * 0.14, 0.36, -0.02],
        turn: [0, side * 0.3, side * 0.5],
        size: [1.1, 0.2, 0.7],
      }),
    ),
  ],
  moth: () => [
    part(ball(0.1), '#cdb894', { at: [0, 0.14, 0], size: [1, 1, 2.2] }),
    part(ball(0.08), '#bfa77f', { at: [0, 0.17, 0.22] }),
    ...eyes(0.05, 0.2, 0.28),
    ...[-1, 1].flatMap((side) => [
      leaning(cone(0.025, 0.18, 4), '#8a7454', 0.18, 0.5, side * 0.5, [side * 0.03, 0.22, 0.25]),
      // Soft wings, front and back, with a spot on each front one.
      part(ball(0.22), '#efe3c8', {
        at: [side * 0.27, 0.2, 0.02],
        turn: [0, 0, side * 0.25],
        size: [1.3, 0.15, 1],
      }),
      part(ball(0.15), '#e6d6b5', {
        at: [side * 0.2, 0.17, -0.15],
        turn: [0, 0, side * 0.2],
        size: [1.3, 0.15, 1],
      }),
      part(gem(0.04), '#b39a72', { at: [side * 0.32, 0.24, 0.05] }),
    ]),
  ],
  hedgehog: () => [
    part(dome(0.3), '#9a7452', { at: [0, -0.03, -0.03], size: [1, 0.85, 1.25] }),
    part(cone(0.1, 0.22, 6), '#e3c39a', { at: [0, 0.1, 0.38], turn: [Math.PI / 2, 0, 0] }),
    part(gem(0.035), EYE, { at: [0, 0.1, 0.5] }),
    ...eyes(0.07, 0.17, 0.33),
    // Spikes all over the back, none on the face.
    ...[
      [0.25, 3],
      [0.7, 6],
      [1.15, 8],
    ].flatMap(([tilt, count]) =>
      Array.from({ length: count }, (_, i) => (i + 0.5) / count)
        .map((share) => Math.PI * 0.3 + share * Math.PI * 1.4)
        .map((spin) =>
          leaning(cone(0.04, 0.18, 4), '#5c4330', 0.18, tilt, spin, [
            0.27 * Math.sin(tilt) * Math.sin(spin),
            0.23 * Math.cos(tilt) - 0.03,
            0.34 * Math.sin(tilt) * Math.cos(spin) - 0.03,
          ]),
        ),
    ),
  ],
  frog: () => [
    part(ball(0.2), '#69b84a', { at: [0, 0.12, 0], size: [1.15, 0.7, 1.1] }),
    part(ball(0.15), '#cfe6a0', { at: [0, 0.07, 0.08], size: [1, 0.5, 1] }),
    ...[-1, 1].flatMap((side) => [
      part(ball(0.07), '#69b84a', { at: [side * 0.1, 0.26, 0.12] }),
      part(ball(0.09), '#5aa53e', { at: [side * 0.2, 0.05, -0.08], size: [1, 0.6, 1.8] }),
      part(ball(0.05), '#5aa53e', { at: [side * 0.12, 0.02, 0.2], size: [1.2, 0.5, 1.4] }),
    ]),
    ...eyes(0.11, 0.29, 0.17, '#1f2a1a', 0.035),
  ],
};

/** The species that fly, so they hover over the ground while awake. */
export const FLYING_SPECIES: ReadonlySet<string> = new Set(['bee', 'moth']);

/** A creature of the species; an unknown species shows as a worm. */
export function creatureModel(species: string): THREE.BufferGeometry {
  return merge((SPECIES[species] ?? SPECIES['worm'])());
}

/** The little "z" over a napping creature, as a tiny pixel picture, top row first. */
const NAP_PICTURE = [
  '........',
  '.######.',
  '.....##.',
  '....##..',
  '...##...',
  '..##....',
  '.######.',
  '........',
];

/** The "z" picture as a texture: white where it is drawn, see-through elsewhere. */
export function napTexture(): THREE.DataTexture {
  const size = NAP_PICTURE.length;
  const data = new Uint8Array(size * size * 4);
  // A data texture's first row is its bottom one.
  [...NAP_PICTURE]
    .reverse()
    .forEach((row, y) =>
      [...row].forEach((pixel, x) =>
        data.set([255, 255, 255, pixel === '#' ? 255 : 0], (y * size + x) * 4),
      ),
    );
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
