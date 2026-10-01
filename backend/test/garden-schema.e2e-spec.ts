import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Decoration } from '../src/garden/decoration.entity';
import { Plant } from '../src/garden/plant.entity';
import { InventoryItem } from '../src/inventory/inventory-item.entity';
import { Unlock } from '../src/inventory/unlock.entity';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const NOW = new Date('2030-01-01T00:00:00.000Z');
const UNIQUE_VIOLATION = '23505';

// Uses the dev database and empties the planets table and its children.
describe('Garden schema (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  function insertPlanet(): Promise<Planet> {
    return db.getRepository(Planet).save({
      code: 'GARDEN01',
      name: 'Moonbeam',
      lastSimulatedAt: NOW,
      lastSeenAt: NOW,
    });
  }

  function insertPlant(planetId: string): Promise<Plant> {
    return db.getRepository(Plant).save({
      planetId,
      type: 'clover',
      lat: 12.5,
      lon: -45.25,
      plantedAt: NOW,
    });
  }

  async function seedGarden(planetId: string): Promise<void> {
    await insertPlant(planetId);
    await db.getRepository(Decoration).save({
      planetId,
      type: 'pond',
      lat: -3,
      lon: 100,
      placedAt: NOW,
    });
    await db
      .getRepository(InventoryItem)
      .save({ planetId, itemType: 'clover', kind: 'seed', count: 4 });
    await db
      .getRepository(Unlock)
      .save({ planetId, itemType: 'clover', unlockedAt: NOW });
  }

  function countChildren(planetId: string): Promise<number[]> {
    return Promise.all(
      [Plant, Decoration, InventoryItem, Unlock].map((entity) =>
        db.getRepository(entity).countBy({ planetId }),
      ),
    );
  }

  it('reads a plant back with numbers, not strings, and the defaults', async () => {
    const planet = await insertPlanet();
    const { id } = await insertPlant(planet.id);

    const row = await db.getRepository(Plant).findOneByOrFail({ id });

    // Strict equality, so a numeric column returned as a string fails here.
    expect(row).toMatchObject({
      planetId: planet.id,
      type: 'clover',
      lat: 12.5,
      lon: -45.25,
      stage: 'seed',
      growth: 0,
      water: 0.5,
      lastHarvestedAt: null,
      harvestReady: false,
    });
    expect(row.plantedAt.toISOString()).toBe(NOW.toISOString());
  });

  it('deletes the garden, inventory and unlocks with the planet (ACC-05)', async () => {
    const planet = await insertPlanet();
    await seedGarden(planet.id);
    expect(await countChildren(planet.id)).toEqual([1, 1, 1, 1]);

    await db.getRepository(Planet).delete({ id: planet.id });

    expect(await countChildren(planet.id)).toEqual([0, 0, 0, 0]);
  });

  it('refuses a second inventory row for the same planet and item type', async () => {
    const planet = await insertPlanet();
    await seedGarden(planet.id);

    await expect(
      db
        .getRepository(InventoryItem)
        .insert({ planetId: planet.id, itemType: 'clover', kind: 'seed' }),
    ).rejects.toMatchObject({ driverError: { code: UNIQUE_VIOLATION } });
  });
});
