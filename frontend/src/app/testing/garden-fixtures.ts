import { CatalogueDto } from '../core/models/catalogue';
import { PlanetSnapshotDto, PlantDto } from '../core/models/planet-snapshot';

/** Test data shared by the gardening specs: a small catalogue and a planet to garden on. */

export const CATALOGUE: CatalogueDto = {
  plants: [
    {
      id: 'clover',
      name: 'Clover',
      waterPref: 'medium',
      lightPref: 'partial',
      bloomMinutes: 8,
      description: 'Pops up fast.',
      unlockHint: 'A starter seed.',
    },
    {
      id: 'sunflower',
      name: 'Sunflower',
      waterPref: 'medium',
      lightPref: 'full-sun',
      bloomMinutes: 120,
      description: 'Very tall.',
      unlockHint: 'A starter seed.',
    },
  ],
  decorations: [
    {
      id: 'pond',
      name: 'Pond',
      footprintSteps: 3,
      isWater: true,
      description: 'Splashy.',
      unlockHint: 'A reward.',
    },
    {
      id: 'rock',
      name: 'Rock',
      footprintSteps: 1,
      isWater: false,
      description: 'Confident.',
      unlockHint: 'A reward.',
    },
  ],
  species: [{ id: 'snail', name: 'Snail', hint: 'Likes clover.' }],
};

export const MOSSY: PlanetSnapshotDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  radiusLevel: 1,
  maxPlants: 60,
  tutorialStep: 0,
  serverTime: '2026-10-01T10:00:00.000Z',
  plants: [],
  decorations: [],
  inventory: [
    { itemType: 'clover', kind: 'seed', count: 3 },
    { itemType: 'pond', kind: 'decoration', count: 1 },
  ],
  unlocks: ['clover', 'pond'],
  clouds: [],
  sun: { angle: 0, overrideAngle: null, overrideAt: null },
};

/** A plant of the snapshot shape, with only what a spec cares about given. */
export function plantAt(
  id: string,
  lat: number,
  lon: number,
  extra: Partial<PlantDto> = {},
): PlantDto {
  return {
    id,
    type: 'clover',
    lat,
    lon,
    stage: 'seed',
    growth: 0,
    water: 0.6,
    plantedAt: '2026-10-01T10:00:00.000Z',
    harvestReady: false,
    ...extra,
  };
}
