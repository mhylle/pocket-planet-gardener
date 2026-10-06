import { Species } from '../core/models/creature';
import { DEFAULT_GAME_CONFIG } from '../core/models/game-config';
import { PlanetSnapshotDto, PlantStage } from '../core/models/planet-snapshot';
import { MOSSY, creatureAt, plantAt } from './garden-fixtures';

/** Every plant type, stage, decoration and species the scene has a model for. */
export const PLANT_TYPES = [
  'clover',
  'sunflower',
  'tulip',
  'bluebell',
  'moonflower',
  'mushroom',
  'fern',
  'cactus',
];
export const PLANT_STAGES: PlantStage[] = ['seed', 'sprout', 'young', 'bloom'];
export const DECORATION_TYPES = ['pond', 'rock', 'lamp-post', 'bench', 'tiny-house'];
export const SPECIES: Species[] = ['worm', 'snail', 'bee', 'moth', 'hedgehog', 'frog'];

/** Turns between neighbours on the Fibonacci lattice, in degrees. */
const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5));

/**
 * The i-th of n spots spread evenly over the planet (a Fibonacci lattice), in degrees, with the
 * longitudes turned by a further offset.
 */
function spot(i: number, n: number, offset = 0): { lat: number; lon: number } {
  const lat = (Math.asin(1 - (2 * (i + 0.5)) / n) * 180) / Math.PI;
  const lon = ((i * GOLDEN_ANGLE + offset) % 360) - 180;
  return { lat, lon };
}

/**
 * A planet filled to the limits for the performance specs (NFR-02): maxPlants plants, cycling
 * through every type and then every stage, with every fifth plant thirsty (it droops) and every
 * bloom with seeds ready (it sparkles); maxCreatures creatures of every species; three clouds;
 * and one of each decoration. The plants are spread evenly over the planet; the decorations and
 * creatures are too, on a lattice of their own, so their spots do not depend on the number of
 * plants. With 32 plants or more every type and stage is there, so more plants add no new
 * models. type gives every plant one type and stage instead.
 */
export function fullPlanet({
  id = 'full-planet',
  plants = DEFAULT_GAME_CONFIG.maxPlants,
  creatures = DEFAULT_GAME_CONFIG.maxCreatures,
  type,
}: { id?: string; plants?: number; creatures?: number; type?: string } = {}): PlanetSnapshotDto {
  const others = DECORATION_TYPES.length + creatures;
  let next = 0;
  const take = () => spot(next++, others, 90);
  return {
    ...MOSSY,
    id,
    maxPlants: DEFAULT_GAME_CONFIG.maxPlants,
    plants: Array.from({ length: plants }, (_, i) => {
      const { lat, lon } = spot(i, plants);
      const stage = type ? 'young' : PLANT_STAGES[Math.floor(i / PLANT_TYPES.length) % 4];
      return plantAt(`plant-${i}`, lat, lon, {
        type: type ?? PLANT_TYPES[i % PLANT_TYPES.length],
        stage,
        growth: stage === 'bloom' ? 1 : 0.5,
        water: i % 5 === 0 ? 0.05 : 0.6,
        harvestReady: stage === 'bloom',
      });
    }),
    decorations: DECORATION_TYPES.map((decoration) => ({
      id: `${decoration}-1`,
      type: decoration,
      ...take(),
    })),
    creatures: Array.from({ length: creatures }, (_, i) => {
      const { lat, lon } = take();
      return creatureAt(`creature-${i}`, lat, lon, {
        species: SPECIES[i % SPECIES.length],
        name: `Creature ${i + 1}`,
      });
    }),
    clouds: [
      { id: 'cloud-1', lat: 10, lon: 0, water: 1, at: MOSSY.serverTime },
      { id: 'cloud-2', lat: -20, lon: 120, water: 0.5, at: MOSSY.serverTime },
      { id: 'cloud-3', lat: 30, lon: -120, water: 0.1, at: MOSSY.serverTime },
    ],
  };
}
