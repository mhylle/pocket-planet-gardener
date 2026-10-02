import * as THREE from 'three';
import { FLYING_SPECIES, creatureModel, napTexture } from './creature-models';

const SPECIES = ['worm', 'snail', 'bee', 'moth', 'hedgehog', 'frog'];

describe('creatureModel', () => {
  it.each(SPECIES)(
    'builds a %s as one flat, vertex-coloured geometry about a step long',
    (species) => {
      const geometry = creatureModel(species);
      const count = geometry.getAttribute('position').count;
      expect(geometry.index).toBeNull();
      expect(count % 3).toBe(0);
      expect(geometry.getAttribute('normal').count).toBe(count);
      expect(geometry.getAttribute('color').count).toBe(count);

      geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox!;
      // On the ground, or just into it, and no bigger than a plant spot or two.
      expect(min.y).toBeGreaterThan(-0.1);
      expect(min.y).toBeLessThan(0.05);
      expect(Math.max(-min.x, max.x, -min.z, max.z)).toBeLessThan(0.65);
      // Facing +z: its head reaches further forward than its tail back.
      expect(max.z).toBeGreaterThan(-min.z);
    },
  );

  it('gives each species its own model, and a worm for one it does not know', () => {
    const sizes = SPECIES.map((species) => creatureModel(species).getAttribute('position').count);
    expect(new Set(sizes).size).toBe(SPECIES.length);
    expect(creatureModel('dragon').getAttribute('position').count).toBe(sizes[0]);
  });

  it('lets the bee and the moth fly', () => {
    expect(SPECIES.filter((species) => FLYING_SPECIES.has(species))).toEqual(['bee', 'moth']);
  });
});

describe('napTexture', () => {
  it('draws a white "z" on a see-through square', () => {
    const texture = napTexture();
    const { data, width, height } = texture.image as {
      data: Uint8Array;
      width: number;
      height: number;
    };
    expect([width, height]).toEqual([8, 8]);
    const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    // The bottom row is first: the bar along the bottom of the z, and its diagonal going up.
    expect(alpha(1, 1)).toBe(255);
    expect(alpha(6, 1)).toBe(255);
    expect(alpha(5, 5)).toBe(255);
    expect(alpha(1, 5)).toBe(0);
    expect(alpha(0, 0)).toBe(0);
    expect(texture.magFilter).toBe(THREE.NearestFilter);
  });
});
