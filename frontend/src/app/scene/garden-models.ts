import * as THREE from 'three';
import { PlantStage } from '../core/models/planet-snapshot';
import { leaning, merge, part } from './low-poly';

/*
 * The cosy low-poly plants and decorations (D-8), built from three.js primitives. Units are
 * steps: a plant fits a circle one step across, a decoration its footprint. y is up and 0 is
 * the ground; every model reaches a little below it, so it meets the faceted planet without a
 * gap wherever it stands.
 */

const SOIL = '#8a6446';

/** How a plant type looks: its leaf and flower colours, its full height, and its bloom. */
interface PlantLook {
  leaf: string;
  flower: string;
  height: number;
  bloom: (look: PlantLook) => THREE.BufferGeometry[];
  /** For types that do not grow up as a stem with leaves. */
  young?: (look: PlantLook) => THREE.BufferGeometry[];
}

const ball = (radius: number) => new THREE.SphereGeometry(radius, 7, 5);
const gem = (radius: number) => new THREE.IcosahedronGeometry(radius, 0);
const rod = (top: number, bottom: number, height: number, sides = 6) =>
  new THREE.CylinderGeometry(top, bottom, height, sides);
const cone = (radius: number, height: number, sides = 6) =>
  new THREE.ConeGeometry(radius, height, sides);
const dome = (radius: number) =>
  new THREE.SphereGeometry(radius, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const box = (width: number, height: number, depth: number) =>
  new THREE.BoxGeometry(width, height, depth);

/** The little heap of soil every plant grows from. */
const mound = (radius = 0.3) => part(ball(radius), SOIL, { size: [1, 0.5, 1] });

/** A stem from the ground up to height. */
const stem = (look: PlantLook, height: number, thickness = 0.03) =>
  part(rod(thickness * 0.8, thickness, height + 0.1, 5), look.leaf, {
    at: [0, height / 2 - 0.05, 0],
  });

/** A pair of flat leaves either side of the stem at height y. */
const leaves = (look: PlantLook, y: number, size = 0.1) =>
  [-1, 1].map((side) =>
    part(ball(size), look.leaf, {
      at: [side * size, y, 0],
      turn: [0, 0, side * 0.5],
      size: [1.6, 0.35, 0.8],
    }),
  );

const LOOKS: Record<string, PlantLook> = {
  clover: {
    leaf: '#5fae55',
    flower: '#f4dbe9',
    height: 0.5,
    bloom: (look) => [
      mound(),
      ...[0, 2.1, 4.2].map((angle) =>
        part(ball(0.13), look.leaf, {
          at: [0.16 * Math.sin(angle), 0.1, 0.16 * Math.cos(angle)],
          size: [1, 0.6, 1],
        }),
      ),
      ...[-1, 1].flatMap((side) => [
        part(rod(0.015, 0.015, 0.44, 4), look.leaf, { at: [side * 0.08, 0.22, side * 0.05] }),
        part(ball(0.075), look.flower, { at: [side * 0.08, 0.44, side * 0.05] }),
      ]),
    ],
  },
  sunflower: {
    leaf: '#5e9c3f',
    flower: '#ffc93a',
    height: 1.4,
    bloom: (look) => [
      mound(),
      stem(look, 1.2, 0.05),
      ...leaves(look, 0.45, 0.12),
      ...leaves(look, 0.8, 0.1),
      part(rod(0.28, 0.28, 0.06, 10), look.flower, { at: [0, 1.22, 0.06], turn: [1.2, 0, 0] }),
      part(rod(0.13, 0.13, 0.08, 8), '#7a4a22', { at: [0, 1.23, 0.09], turn: [1.2, 0, 0] }),
    ],
  },
  tulip: {
    leaf: '#5aa35a',
    flower: '#ef5b6b',
    height: 0.75,
    bloom: (look) => [
      mound(),
      stem(look, 0.55),
      ...[-1, 1].map((side) =>
        part(ball(0.08), look.leaf, {
          at: [side * 0.08, 0.2, 0],
          turn: [0, 0, -side * 0.35],
          size: [0.8, 3, 0.5],
        }),
      ),
      part(rod(0.13, 0.08, 0.22, 6), look.flower, { at: [0, 0.63, 0] }),
    ],
  },
  bluebell: {
    leaf: '#4f9a5f',
    flower: '#6c8cf5',
    height: 0.7,
    bloom: (look) => [
      mound(),
      stem(look, 0.62, 0.025),
      ...leaves(look, 0.12, 0.09),
      ...[
        [0.07, 0.68, 0],
        [0.12, 0.54, 0.04],
        [0.1, 0.4, -0.04],
      ].map(([x, y, z]) => part(cone(0.07, 0.13), look.flower, { at: [x, y, z] })),
    ],
  },
  moonflower: {
    leaf: '#4d8a5c',
    flower: '#efe6ff',
    height: 0.6,
    bloom: (look) => [
      mound(),
      stem(look, 0.45, 0.035),
      ...leaves(look, 0.25, 0.12),
      part(cone(0.24, 0.18, 7), look.flower, { at: [0, 0.52, 0], turn: [Math.PI, 0, 0] }),
      part(gem(0.05), '#fff3b0', { at: [0, 0.6, 0] }),
    ],
  },
  mushroom: {
    leaf: '#f2e6cf',
    flower: '#d9544d',
    height: 0.5,
    bloom: (look) => [
      mound(0.32),
      part(rod(0.08, 0.1, 0.4, 7), look.leaf, { at: [0, 0.1, 0] }),
      part(dome(0.24), look.flower, { at: [0, 0.28, 0], size: [1, 0.8, 1] }),
      ...[
        [0.1, 0.43, 0.08],
        [-0.12, 0.4, 0.05],
        [0.02, 0.41, -0.14],
      ].map(([x, y, z]) => part(gem(0.04), '#fff7ee', { at: [x, y, z] })),
      part(rod(0.04, 0.05, 0.2, 5), look.leaf, { at: [0.22, 0.04, 0.12] }),
      part(dome(0.11), look.flower, { at: [0.22, 0.13, 0.12] }),
    ],
    young: (look) => [
      mound(0.24),
      part(rod(0.05, 0.06, 0.3, 6), look.leaf, { at: [0, 0.1, 0] }),
      part(dome(0.14), look.flower, { at: [0, 0.22, 0] }),
    ],
  },
  fern: {
    leaf: '#3f8f4a',
    flower: '#7cc36b',
    height: 0.6,
    bloom: (look) => [
      mound(),
      ...[0, 1, 2, 3, 4].map((i) =>
        leaning(cone(0.06, 0.62, 4), look.leaf, 0.62, 0.6, (i * 2 * Math.PI) / 5),
      ),
      leaning(cone(0.05, 0.5, 4), look.flower, 0.5, 0.15, 0),
    ],
    young: (look) => [
      mound(0.24),
      ...[0, 1, 2].map((i) =>
        leaning(cone(0.045, 0.42, 4), look.leaf, 0.42, 0.45, (i * 2 * Math.PI) / 3),
      ),
    ],
  },
  cactus: {
    leaf: '#4fa36b',
    flower: '#ff86b8',
    height: 0.85,
    bloom: (look) => [
      mound(),
      part(rod(0.16, 0.18, 0.8, 7), look.leaf, { at: [0, 0.3, 0] }),
      part(ball(0.16), look.leaf, { at: [0, 0.7, 0] }),
      part(rod(0.07, 0.07, 0.16, 6), look.leaf, { at: [0.15, 0.32, 0], turn: [0, 0, Math.PI / 2] }),
      part(rod(0.07, 0.07, 0.24, 6), look.leaf, { at: [0.22, 0.42, 0] }),
      part(gem(0.08), look.flower, { at: [0, 0.87, 0] }),
    ],
    young: (look) => [
      mound(0.24),
      part(rod(0.1, 0.12, 0.4, 7), look.leaf, { at: [0, 0.12, 0] }),
      part(ball(0.1), look.leaf, { at: [0, 0.32, 0] }),
    ],
  },
};

/** For a plant type this client does not know yet. */
const UNKNOWN_LOOK: PlantLook = { ...LOOKS['clover'], flower: '#ffffff' };

/** A plant of the type at the stage: a seed mound, a sprout, a young plant, then the bloom. */
export function plantModel(type: string, stage: PlantStage): THREE.BufferGeometry {
  const look = LOOKS[type] ?? UNKNOWN_LOOK;
  switch (stage) {
    case 'seed':
      return merge([mound(0.3), part(gem(0.07), look.flower, { at: [0.1, 0.13, 0.05] })]);
    case 'sprout':
      return merge([mound(0.24), stem(look, 0.22, 0.025), ...leaves(look, 0.2, 0.08)]);
    case 'young': {
      if (look.young) {
        return merge(look.young(look));
      }
      const height = Math.max(0.3, look.height * 0.55);
      return merge([
        mound(0.26),
        stem(look, height),
        ...leaves(look, height * 0.5),
        part(gem(0.075), look.flower, { at: [0, height, 0] }),
      ]);
    }
    case 'bloom':
      return merge(look.bloom(look));
  }
}

const DECORATIONS: Record<string, () => THREE.BufferGeometry[]> = {
  pond: () => [
    part(rod(1.45, 1.5, 0.4, 10), '#d9c48f', { at: [0, -0.15, 0] }),
    part(rod(1.25, 1.25, 0.42, 10), '#5bb1e3', { at: [0, -0.13, 0] }),
    part(rod(0.2, 0.2, 0.03, 7), '#6fb35a', { at: [0.5, 0.09, 0.3] }),
    part(gem(0.14), '#a7adb3', { at: [-1.2, 0.05, 0.6] }),
    part(gem(0.1), '#bfc4c9', { at: [1.1, 0.04, -0.7] }),
  ],
  rock: () => [
    part(gem(0.32), '#9aa1a8', { at: [0, 0.05, 0], size: [1, 0.7, 0.85] }),
    part(gem(0.15), '#b3b9bf', { at: [0.25, -0.02, 0.15] }),
  ],
  'lamp-post': () => [
    part(rod(0.12, 0.15, 0.3, 6), '#3d4650', { at: [0, -0.05, 0] }),
    part(rod(0.035, 0.035, 1.1, 6), '#3d4650', { at: [0, 0.55, 0] }),
    part(box(0.2, 0.22, 0.2), '#ffe28a', { at: [0, 1.15, 0] }),
    part(cone(0.17, 0.12, 4), '#3d4650', { at: [0, 1.32, 0], turn: [0, Math.PI / 4, 0] }),
  ],
  bench: () => [
    part(box(1.2, 0.08, 0.36), '#b07a45', { at: [0, 0.3, 0] }),
    part(box(1.2, 0.26, 0.06), '#b07a45', { at: [0, 0.5, -0.16] }),
    ...[
      [-0.52, -0.13],
      [-0.52, 0.13],
      [0.52, -0.13],
      [0.52, 0.13],
    ].map(([x, z]) => part(box(0.07, 0.5, 0.07), '#6e4628', { at: [x, 0.05, z] })),
  ],
  'tiny-house': () => [
    part(box(1.3, 0.95, 1.1), '#f6e7c8', { at: [0, 0.3, 0] }),
    part(cone(1.1, 0.7, 4), '#d65a4a', { at: [0, 1.125, 0], turn: [0, Math.PI / 4, 0] }),
    part(box(0.3, 0.45, 0.04), '#7a4b2a', { at: [0, 0.2, 0.56] }),
    part(box(0.24, 0.22, 0.04), '#bfe6f7', { at: [-0.38, 0.45, 0.56] }),
    part(box(0.24, 0.22, 0.04), '#bfe6f7', { at: [0.38, 0.45, 0.56] }),
    part(box(0.16, 0.35, 0.16), '#9c4a3c', { at: [0.3, 1.25, -0.2] }),
  ],
};

/** A decoration of the type; an unknown type shows as a rock. */
export function decorationModel(type: string): THREE.BufferGeometry {
  return merge((DECORATIONS[type] ?? DECORATIONS['rock'])());
}
