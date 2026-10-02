import * as THREE from 'three';
import { PlantStage } from '../core/models/planet-snapshot';
import { decorationModel, plantModel } from './garden-models';

const PLANTS = [
  'clover',
  'sunflower',
  'tulip',
  'bluebell',
  'moonflower',
  'mushroom',
  'fern',
  'cactus',
];
const STAGES: PlantStage[] = ['seed', 'sprout', 'young', 'bloom'];
/** Steps across, as in the backend content. */
const DECORATION_FOOTPRINTS: Record<string, number> = {
  pond: 3,
  rock: 1,
  'lamp-post': 1,
  bench: 2,
  'tiny-house': 3,
};

/** The farthest any vertex is from the model's up axis, and its lowest and highest points. */
function measure(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position');
  let reach = 0;
  let bottom = Infinity;
  let top = -Infinity;
  for (let i = 0; i < position.count; i++) {
    reach = Math.max(reach, Math.hypot(position.getX(i), position.getZ(i)));
    bottom = Math.min(bottom, position.getY(i));
    top = Math.max(top, position.getY(i));
  }
  return { reach, bottom, top };
}

function expectFlatColoured(geometry: THREE.BufferGeometry) {
  const count = geometry.getAttribute('position').count;
  expect(geometry.index).toBeNull();
  expect(count % 3).toBe(0);
  expect(geometry.getAttribute('normal').count).toBe(count);
  expect(geometry.getAttribute('color').count).toBe(count);
}

describe('plantModel', () => {
  it('builds every type at every stage as one flat, vertex-coloured geometry', () => {
    for (const type of PLANTS) {
      for (const stage of STAGES) {
        expectFlatColoured(plantModel(type, stage));
      }
    }
  });

  it('grows taller with each stage, for every type (GRD-05 AC1)', () => {
    for (const type of PLANTS) {
      const tops = STAGES.map((stage) => measure(plantModel(type, stage)).top);
      for (let i = 1; i < tops.length; i++) {
        expect(tops[i], `${type} ${STAGES[i]}`).toBeGreaterThan(tops[i - 1]);
      }
    }
  });

  it('gives each type a bloom of its own colours and shape', () => {
    const blooms = PLANTS.map((type) => {
      const geometry = plantModel(type, 'bloom');
      const colours = new Set<string>();
      const colour = geometry.getAttribute('color');
      for (let i = 0; i < colour.count; i++) {
        colours.add(new THREE.Color().fromBufferAttribute(colour, i).getHexString());
      }
      return [...colours].sort().join() + '|' + geometry.getAttribute('position').count;
    });

    expect(new Set(blooms).size).toBe(PLANTS.length);
  });

  it('fits a plant in its one-step footprint and reaches below the ground', () => {
    for (const type of PLANTS) {
      for (const stage of STAGES) {
        const { reach, bottom } = measure(plantModel(type, stage));
        expect(reach, `${type} ${stage}`).toBeLessThanOrEqual(0.5);
        expect(bottom, `${type} ${stage}`).toBeLessThan(-0.1);
      }
    }
  });

  it('still draws a type it does not know', () => {
    expectFlatColoured(plantModel('dandelion', 'bloom'));
  });
});

describe('decorationModel', () => {
  it('fits every decoration in its footprint, reaching below the ground', () => {
    for (const [type, footprint] of Object.entries(DECORATION_FOOTPRINTS)) {
      const geometry = decorationModel(type);
      const { reach, bottom } = measure(geometry);

      expectFlatColoured(geometry);
      expect(reach, type).toBeLessThanOrEqual(footprint / 2 + 1e-6);
      expect(bottom, type).toBeLessThan(-0.1);
    }
  });

  it('draws the pond as a flat disc that fills its footprint', () => {
    const pond = measure(decorationModel('pond'));

    expect(pond.top).toBeLessThan(0.25);
    expect(pond.reach).toBeGreaterThan(1.2);
  });
});
