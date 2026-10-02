import type { Decoration } from '../../garden/decoration.entity';
import type { Plant } from '../../garden/plant.entity';
import type { InventoryItem } from '../../inventory/inventory-item.entity';
import type { Unlock } from '../../inventory/unlock.entity';
import type { Planet } from '../planet.entity';
import {
  toDecorationDto,
  toEventDto,
  toInventoryItemDto,
  toPlanetSnapshot,
  toPlantDto,
  toSunStateDto,
} from './snapshot.mappers';

const PLANET_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';
const T0 = new Date('2030-01-01T00:00:00.000Z');
const T1 = new Date('2030-01-01T00:05:00.000Z');

// Rows as TypeORM loads them, private columns and relation included, so a
// mapper that copies too much fails the strict comparisons below.

function planetRow(overrides: Partial<Planet> = {}): Planet {
  return {
    id: PLANET_ID,
    code: 'MOON2345',
    name: 'Moonbeam',
    radiusLevel: 2,
    maxPlants: 60,
    version: 3,
    lastSimulatedAt: T0,
    lastSeenAt: T0,
    sunOverrideAngle: null,
    sunOverrideAt: null,
    tutorialStep: 4,
    clouds: [{ id: 'c1', lat: 0, lon: 0, water: 1, at: T0.toISOString() }],
    arrivalTracking: { worm: T0.toISOString() },
    rewardCounter: 7,
    createdAt: T0,
    ...overrides,
  };
}

function plantRow(): Plant {
  return {
    id: 'plant-1',
    planetId: PLANET_ID,
    planet: planetRow(),
    type: 'clover',
    lat: 12.5,
    lon: -45.25,
    stage: 'sprout',
    growth: 0.25,
    water: 0.75,
    plantedAt: T0,
    lastHarvestedAt: T1,
    harvestReady: true,
  };
}

function decorationRow(): Decoration {
  return {
    id: 'decoration-1',
    planetId: PLANET_ID,
    planet: planetRow(),
    type: 'pond',
    lat: -3,
    lon: 100,
    placedAt: T0,
  };
}

function inventoryRow(): InventoryItem {
  return {
    id: 'item-1',
    planetId: PLANET_ID,
    planet: planetRow(),
    itemType: 'tulip',
    kind: 'seed',
    count: 4,
  };
}

function unlockRow(itemType: Unlock['itemType']): Unlock {
  return { planetId: PLANET_ID, itemType, planet: planetRow(), unlockedAt: T0 };
}

describe('snapshot mappers', () => {
  it('maps a plant to exactly its public fields', () => {
    expect(toPlantDto(plantRow())).toStrictEqual({
      id: 'plant-1',
      type: 'clover',
      lat: 12.5,
      lon: -45.25,
      stage: 'sprout',
      growth: 0.25,
      water: 0.75,
      plantedAt: '2030-01-01T00:00:00.000Z',
      harvestReady: true,
    });
  });

  it('maps a decoration to exactly its public fields', () => {
    expect(toDecorationDto(decorationRow())).toStrictEqual({
      id: 'decoration-1',
      type: 'pond',
      lat: -3,
      lon: 100,
    });
  });

  it('maps an inventory stack to its type, kind and count', () => {
    expect(toInventoryItemDto(inventoryRow())).toStrictEqual({
      itemType: 'tulip',
      kind: 'seed',
      count: 4,
    });
  });

  it('serves a drifting sun as two nulls', () => {
    expect(toSunStateDto(planetRow())).toStrictEqual({
      overrideAngle: null,
      overrideAt: null,
    });
  });

  it('serves a dragged sun as its angle and an ISO time', () => {
    const planet = planetRow({ sunOverrideAngle: 1.5, sunOverrideAt: T1 });

    expect(toSunStateDto(planet)).toStrictEqual({
      overrideAngle: 1.5,
      overrideAt: '2030-01-01T00:05:00.000Z',
    });
  });

  it('maps a fact to an event with an ISO time', () => {
    const payload = { plantId: 'plant-1' };

    expect(
      toEventDto({ type: 'bloomed', occurredAt: T0, payload }),
    ).toStrictEqual({
      type: 'bloomed',
      occurredAt: '2030-01-01T00:00:00.000Z',
      payload,
    });
  });

  it('assembles the snapshot from exactly the public planet fields and the mapped rows', () => {
    const snapshot = toPlanetSnapshot(
      planetRow(),
      {
        plants: [plantRow()],
        decorations: [decorationRow()],
        inventory: [inventoryRow()],
        unlocks: [unlockRow('clover'), unlockRow('pond')],
      },
      T1,
    );

    expect(snapshot).toStrictEqual({
      id: PLANET_ID,
      code: 'MOON2345',
      name: 'Moonbeam',
      version: 3,
      createdAt: '2030-01-01T00:00:00.000Z',
      radiusLevel: 2,
      maxPlants: 60,
      tutorialStep: 4,
      serverTime: '2030-01-01T00:05:00.000Z',
      plants: [toPlantDto(plantRow())],
      decorations: [toDecorationDto(decorationRow())],
      inventory: [toInventoryItemDto(inventoryRow())],
      unlocks: ['clover', 'pond'],
      clouds: [{ id: 'c1', lat: 0, lon: 0, water: 1, at: T0.toISOString() }],
      sun: { overrideAngle: null, overrideAt: null },
    });
  });
});
