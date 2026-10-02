import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Plant } from '../src/garden/plant.entity';
import { InventoryItem } from '../src/inventory/inventory-item.entity';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const CREATED = '2030-01-01T00:00:00.000Z';
const ELSEWHERE = '00000000-0000-4000-8000-000000000000';
const GONE = "That isn't on your planet any more.";
const NOT_READY = "This one isn't ready to give seeds yet.";
const COOLDOWN = 'It needs a little while to make more seeds.';
// The starter inventory holds 4 clover seeds; one is planted.
const CLOVERS_LEFT = 3;

/** The ISO time some minutes after CREATED. */
function after(minutes: number): string {
  return new Date(Date.parse(CREATED) + minutes * 60_000).toISOString();
}

// A clover blooms in 8 minutes, so an hour on it is a bloom with seeds ready.
const BLOOMED = after(60);

/** What the database holds, to show what a harvest changed. */
interface Stored {
  version: number;
  clovers: number;
  plant: Plant;
}

function clovers(snapshot: PlanetSnapshotDto): number | undefined {
  return snapshot.inventory.find((item) => item.itemType === 'clover')?.count;
}

// Uses the dev database and empties the planets table and its children.
describe('Harvest (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let planetId: string;
  let plantId: string;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    planetId = await createPlanet('Moonbeam');
    plantId = await plantClover(planetId);
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  async function createPlanet(name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', CREATED)
      .send({ name })
      .expect(201);
    return (res.body as PlanetSnapshotDto).id;
  }

  /** Plants a clover on a new planet, on version 1, and returns its id. */
  async function plantClover(onPlanet: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/garden/plants')
      .set('X-Planet-Id', onPlanet)
      .set('X-Test-Now', CREATED)
      .send({ itemType: 'clover', lat: 10, lon: 20, expectedVersion: 1 })
      .expect(201);
    return (res.body as MutationResult).snapshot.plants[0].id;
  }

  function harvest(now: string, expectedVersion: number, id = plantId) {
    return request(app.getHttpServer())
      .post(`/api/garden/plants/${id}/harvest`)
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ expectedVersion });
  }

  async function sync(now: string, expectedVersion: number) {
    const res = await request(app.getHttpServer())
      .post('/api/planet/sync')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ expectedVersion })
      .expect(200);
    return (res.body as SyncResult).snapshot;
  }

  async function stored(): Promise<Stored> {
    const planet = await db
      .getRepository(Planet)
      .findOneByOrFail({ id: planetId });
    const stack = await db
      .getRepository(InventoryItem)
      .findOneBy({ planetId, itemType: 'clover' });
    return {
      version: planet.version,
      clovers: stack?.count ?? 0,
      plant: await db.getRepository(Plant).findOneByOrFail({ id: plantId }),
    };
  }

  it('gives 1 or 2 seeds of its type and the plant stays in bloom (GRD-08 AC2)', async () => {
    const res = await harvest(BLOOMED, 2).expect(200);
    const { snapshot, newlyUnlocked } = res.body as MutationResult;

    expect([CLOVERS_LEFT + 1, CLOVERS_LEFT + 2]).toContain(clovers(snapshot));
    expect(snapshot.version).toBe(3);
    expect(snapshot.plants).toEqual([
      expect.objectContaining({
        id: plantId,
        stage: 'bloom',
        growth: 1,
        harvestReady: false,
      }),
    ]);
    expect(newlyUnlocked).toEqual([]);
    const { plant, clovers: storedClovers } = await stored();
    expect(plant.lastHarvestedAt?.toISOString()).toBe(BLOOMED);
    expect(storedClovers).toBe(clovers(snapshot));
  });

  it('refuses a second harvest within the cooldown and changes nothing (AC3)', async () => {
    await harvest(BLOOMED, 2).expect(200);
    const before = await stored();

    for (const now of [BLOOMED, after(119)]) {
      const res = await harvest(now, 3).expect(400);
      expect(res.body).toStrictEqual({
        statusCode: 400,
        message: COOLDOWN,
        reason: 'cooldown',
      });
    }

    const { version, clovers: left, plant } = await stored();
    expect({ version, left }).toEqual({ version: 3, left: before.clovers });
    expect(plant.lastHarvestedAt?.toISOString()).toBe(BLOOMED);
  });

  it('has seeds again an hour after the harvest, and gives them (AC1)', async () => {
    await harvest(BLOOMED, 2).expect(200);

    expect((await sync(after(119), 3)).plants[0].harvestReady).toBe(false);
    expect((await sync(after(120), 3)).plants[0]).toMatchObject({
      stage: 'bloom',
      harvestReady: true,
    });

    const before = (await stored()).clovers;
    const res = await harvest(after(120), 3).expect(200);
    const { snapshot } = res.body as MutationResult;
    expect(snapshot.plants[0]).toMatchObject({
      stage: 'bloom',
      harvestReady: false,
    });
    expect([before + 1, before + 2]).toContain(clovers(snapshot));
    expect((await stored()).plant.lastHarvestedAt?.toISOString()).toBe(
      after(120),
    );
  });

  it('has the seeds ready on return when it was harvested before an absence', async () => {
    await harvest(BLOOMED, 2).expect(200);

    const snapshot = await sync(after(3 * 24 * 60), 3);

    expect(snapshot.plants[0]).toMatchObject({
      stage: 'bloom',
      harvestReady: true,
    });
  });

  it.each(['seed', 'young', 'bloom'])(
    'refuses a %s without seeds as not ready and changes nothing',
    async (stage) => {
      await db.query('UPDATE "plants" SET "stage" = $1 WHERE "id" = $2', [
        stage,
        plantId,
      ]);

      const res = await harvest(CREATED, 2).expect(400);

      expect(res.body).toStrictEqual({
        statusCode: 400,
        message: NOT_READY,
        reason: 'not-ready',
      });
      expect(await stored()).toMatchObject({
        version: 2,
        clovers: CLOVERS_LEFT,
        plant: { stage, harvestReady: false, lastHarvestedAt: null },
      });
    },
  );

  it('answers a stale expectedVersion with 409 and changes nothing', async () => {
    const res = await harvest(BLOOMED, 1).expect(409);

    expect(res.body).toMatchObject({ message: 'reload' });
    expect(await stored()).toMatchObject({
      version: 2,
      clovers: CLOVERS_LEFT,
      plant: { lastHarvestedAt: null },
    });
  });

  it('answers a plant that is not on this planet with 404', async () => {
    const foreignId = await plantClover(await createPlanet('Elsewhere'));

    for (const id of [ELSEWHERE, foreignId]) {
      const res = await harvest(BLOOMED, 2, id).expect(404);
      expect(res.body).toMatchObject({ message: GONE });
    }
    expect((await stored()).version).toBe(2);
  });

  it('refuses a malformed id or expectedVersion with 400', async () => {
    await harvest(BLOOMED, 2, 'not-a-uuid').expect(400);
    await harvest(BLOOMED, 0).expect(400);

    expect((await stored()).version).toBe(2);
  });
});
