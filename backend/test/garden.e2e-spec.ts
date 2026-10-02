import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { STARTER_INVENTORY } from '../src/content/starter';
import { Decoration } from '../src/garden/decoration.entity';
import { Plant } from '../src/garden/plant.entity';
import { InventoryItem } from '../src/inventory/inventory-item.entity';
import { InventoryService } from '../src/inventory/inventory.service';
import { Unlock } from '../src/inventory/unlock.entity';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const NOW = '2030-01-01T00:10:00.000Z';
const ELSEWHERE = '00000000-0000-4000-8000-000000000000';
const GONE = "That isn't on your planet any more.";
const TAKEN = 'Something is already there. Try a free spot.';
const NOT_OWNED = "You don't have any of those right now.";

interface PlantBody {
  itemType?: unknown;
  lat?: unknown;
  lon?: unknown;
  expectedVersion?: unknown;
}

/** What the database holds for a planet, to show a refusal changed nothing. */
interface Stored {
  version: number;
  inventory: Record<string, number>;
  plants: number;
  decorations: number;
}

// Uses the dev database and empties the planets table and its children.
describe('Garden (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let planet: PlanetSnapshotDto;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    planet = await createPlanet('Moonbeam');
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  async function createPlanet(name: string): Promise<PlanetSnapshotDto> {
    const res = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', NOW)
      .send({ name })
      .expect(201);
    return res.body as PlanetSnapshotDto;
  }

  function send(
    method: 'post' | 'patch' | 'delete',
    path: string,
    body: object,
    planetId = planet.id,
  ) {
    return request(app.getHttpServer())
      [method](`/api/garden/${path}`)
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', NOW)
      .send(body);
  }

  /** Plants a clover at lat 10, lon 20 on version 1, unless told otherwise. */
  function plant(body: PlantBody = {}, planetId = planet.id) {
    return send(
      'post',
      'plants',
      { itemType: 'clover', lat: 10, lon: 20, expectedVersion: 1, ...body },
      planetId,
    );
  }

  async function plantedId(body: PlantBody = {}): Promise<string> {
    const res = await plant(body).expect(201);
    const { snapshot } = res.body as MutationResult;
    return snapshot.plants[snapshot.plants.length - 1].id;
  }

  /** One pond into the inventory, as a reward would give it. */
  async function grantPond(): Promise<void> {
    const inventory = app.get(InventoryService, { strict: false });
    await db.transaction((em) =>
      inventory.grant(
        em,
        planet.id,
        [{ itemType: 'pond', kind: 'decoration', count: 1 }],
        new Date(NOW),
      ),
    );
  }

  async function placedPondId(lat: number, lon: number, expectedVersion = 1) {
    await grantPond();
    const res = await send('post', 'decorations', {
      itemType: 'pond',
      lat,
      lon,
      expectedVersion,
    }).expect(201);
    return (res.body as MutationResult).snapshot.decorations[0].id;
  }

  async function stored(planetId = planet.id): Promise<Stored> {
    const row = await db
      .getRepository(Planet)
      .findOneByOrFail({ id: planetId });
    const items = await db.getRepository(InventoryItem).findBy({ planetId });
    return {
      version: row.version,
      inventory: Object.fromEntries(items.map((i) => [i.itemType, i.count])),
      plants: await db.getRepository(Plant).countBy({ planetId }),
      decorations: await db.getRepository(Decoration).countBy({ planetId }),
    };
  }

  describe('a new planet (ITM-04 AC1)', () => {
    it('holds seeds of at least 3 types, all unlocked, and no decorations', async () => {
      const types = STARTER_INVENTORY.map((item) => item.itemType).sort();

      expect(types.length).toBeGreaterThanOrEqual(3);
      expect(planet.inventory).toStrictEqual(
        [...STARTER_INVENTORY]
          .sort((a, b) => a.itemType.localeCompare(b.itemType))
          .map(({ itemType, count }) => ({ itemType, kind: 'seed', count })),
      );
      expect(planet.unlocks).toEqual(types);
      expect(planet.decorations).toEqual([]);
      const unlocks = await db
        .getRepository(Unlock)
        .findBy({ planetId: planet.id });
      expect(unlocks.map((u) => u.unlockedAt.toISOString())).toEqual(
        types.map(() => NOW),
      );
    });
  });

  describe('POST /api/garden/plants', () => {
    it('plants a seed and takes one from the inventory (GRD-01 AC1)', async () => {
      const res = await plant().expect(201);
      const body = res.body as MutationResult;

      expect(body.snapshot.version).toBe(2);
      expect(body.snapshot.plants).toStrictEqual([
        {
          id: expect.any(String) as string,
          type: 'clover',
          lat: 10,
          lon: 20,
          stage: 'seed',
          growth: 0,
          water: 0.5,
          plantedAt: NOW,
          harvestReady: false,
        },
      ]);
      expect(body.snapshot.inventory).toContainEqual({
        itemType: 'clover',
        kind: 'seed',
        count: 3,
      });
      expect(body.events).toEqual([]);
      expect(body.newlyUnlocked).toEqual([]);
    });

    it('refuses an occupied spot and changes nothing (GRD-01 AC3)', async () => {
      await plant().expect(201);

      const res = await plant({ lat: 10.5, expectedVersion: 2 }).expect(400);

      expect(res.body).toStrictEqual({
        statusCode: 400,
        message: TAKEN,
        reason: 'occupied-plant',
      });
      expect(await stored()).toMatchObject({
        version: 2,
        inventory: { clover: 3 },
        plants: 1,
      });
    });

    it('removes a used-up stack, then refuses as not owned (ITM-01 AC2)', async () => {
      await plant({ itemType: 'mushroom' }).expect(201);
      const res = await plant({
        itemType: 'mushroom',
        lat: -10,
        expectedVersion: 2,
      }).expect(201);

      const { snapshot } = res.body as MutationResult;
      expect(snapshot.inventory.map((i) => i.itemType)).not.toContain(
        'mushroom',
      );
      expect((await stored()).inventory).not.toHaveProperty('mushroom');

      const refused = await plant({
        itemType: 'mushroom',
        lat: -40,
        expectedVersion: 3,
      }).expect(400);
      expect(refused.body).toStrictEqual({
        statusCode: 400,
        message: NOT_OWNED,
        reason: 'not-owned',
      });
      expect((await stored()).version).toBe(3);
    });

    it('tells the player kindly when the planet is full (GRD-01 AC4)', async () => {
      await db.query('UPDATE "planets" SET "max_plants" = 1 WHERE "id" = $1', [
        planet.id,
      ]);
      await plant().expect(201);

      const res = await plant({ lat: -40, lon: 100, expectedVersion: 2 });

      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        statusCode: 400,
        message: 'Your planet is full for now. Dig up a plant to make room.',
        reason: 'planet-full',
      });
      expect(await stored()).toMatchObject({
        version: 2,
        inventory: { clover: 3 },
        plants: 1,
      });
    });

    it.each<[string, PlantBody]>([
      ['lat 91', { lat: 91 }],
      ['lat -91', { lat: -91 }],
      ['lon 181', { lon: 181 }],
      ['lon -181', { lon: -181 }],
      ['a lat sent as text', { lat: '10' }],
      ['an unknown seed', { itemType: 'rose' }],
      ['a decoration as a seed', { itemType: 'pond' }],
      ['no expectedVersion', { expectedVersion: undefined }],
      ['expectedVersion 0', { expectedVersion: 0 }],
    ])('refuses %s with 400 and changes nothing', async (_label, body) => {
      await plant(body).expect(400);

      expect(await stored()).toMatchObject({
        version: 1,
        inventory: { clover: 4 },
        plants: 0,
      });
    });

    it('answers a stale expectedVersion with 409 and changes nothing', async () => {
      await plant().expect(201);

      const res = await plant({ lat: -40, expectedVersion: 1 }).expect(409);

      expect(res.body).toMatchObject({ message: 'reload' });
      expect(await stored()).toMatchObject({
        version: 2,
        inventory: { clover: 3 },
        plants: 1,
      });
    });
  });

  describe('DELETE /api/garden/plants/:id (GRD-07 AC1)', () => {
    async function digUpAt(stage: string): Promise<MutationResult> {
      const id = await plantedId();
      await db.query('UPDATE "plants" SET "stage" = $1 WHERE "id" = $2', [
        stage,
        id,
      ]);
      const res = await send('delete', `plants/${id}`, {
        expectedVersion: 2,
      }).expect(200);
      return res.body as MutationResult;
    }

    it.each(['seed', 'sprout'])(
      'gives the seed back for a %s',
      async (stage) => {
        const { snapshot, newlyUnlocked } = await digUpAt(stage);

        expect(snapshot.version).toBe(3);
        expect(snapshot.plants).toEqual([]);
        expect(newlyUnlocked).toEqual([]);
        expect((await stored()).inventory).toMatchObject({ clover: 4 });
      },
    );

    it.each(['young', 'bloom'])(
      'gives nothing back for a %s',
      async (stage) => {
        const { snapshot } = await digUpAt(stage);

        expect(snapshot.version).toBe(3);
        expect(snapshot.plants).toEqual([]);
        expect((await stored()).inventory).toMatchObject({ clover: 3 });
      },
    );

    it('answers a plant that is not on this planet with 404', async () => {
      const other = await createPlanet('Elsewhere');
      const res = await plant({}, other.id).expect(201);
      const foreignId = (res.body as MutationResult).snapshot.plants[0].id;

      for (const id of [ELSEWHERE, foreignId]) {
        const gone = await send('delete', `plants/${id}`, {
          expectedVersion: 1,
        }).expect(404);
        expect(gone.body).toMatchObject({ message: GONE });
      }
      expect((await stored()).version).toBe(1);
      expect((await stored(other.id)).plants).toBe(1);
    });

    it('refuses a malformed id with 400', async () => {
      await send('delete', 'plants/not-a-uuid', { expectedVersion: 1 }).expect(
        400,
      );
    });
  });

  describe('decorations (ITM-02)', () => {
    it('refuses one the planet does not own', async () => {
      const res = await send('post', 'decorations', {
        itemType: 'pond',
        lat: 0,
        lon: 60,
        expectedVersion: 1,
      }).expect(400);

      expect(res.body).toMatchObject({ reason: 'not-owned' });
      expect((await stored()).version).toBe(1);
    });

    it('places, moves and puts away a pond, restoring the inventory', async () => {
      await grantPond();

      const placed = await send('post', 'decorations', {
        itemType: 'pond',
        lat: 0,
        lon: 60,
        expectedVersion: 1,
      }).expect(201);
      const afterPlace = (placed.body as MutationResult).snapshot;
      const id = afterPlace.decorations[0].id;
      expect(afterPlace.decorations).toStrictEqual([
        { id, type: 'pond', lat: 0, lon: 60 },
      ]);
      expect(await stored()).toMatchObject({ version: 2, decorations: 1 });
      expect((await stored()).inventory).not.toHaveProperty('pond');

      const moved = await send('patch', `decorations/${id}/position`, {
        lat: 0,
        lon: 90,
        expectedVersion: 2,
      }).expect(200);
      expect((moved.body as MutationResult).snapshot.decorations).toEqual([
        { id, type: 'pond', lat: 0, lon: 90 },
      ]);

      const putAway = await send('delete', `decorations/${id}`, {
        expectedVersion: 3,
      }).expect(200);
      const body = putAway.body as MutationResult;
      expect(body.snapshot.version).toBe(4);
      expect(body.snapshot.decorations).toEqual([]);
      expect(body.snapshot.inventory).toContainEqual({
        itemType: 'pond',
        kind: 'decoration',
        count: 1,
      });
      expect(body.newlyUnlocked).toEqual([]);
    });

    it('refuses planting inside the pond footprint as water', async () => {
      await placedPondId(0, 60);

      const res = await plant({ lat: 0, lon: 61, expectedVersion: 2 });

      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        statusCode: 400,
        message: 'That spot is a little too splashy. Try a dry one.',
        reason: 'occupied-water',
      });
      expect(await stored()).toMatchObject({
        version: 2,
        inventory: { clover: 4 },
        plants: 0,
      });
    });

    it('moves onto its own old spot, but not onto a plant', async () => {
      await plant({ lat: 0, lon: 0 }).expect(201);
      const id = await placedPondId(0, 60, 2);

      await send('patch', `decorations/${id}/position`, {
        lat: 0,
        lon: 61,
        expectedVersion: 3,
      }).expect(200);
      const res = await send('patch', `decorations/${id}/position`, {
        lat: 0,
        lon: 1,
        expectedVersion: 4,
      }).expect(400);

      expect(res.body).toMatchObject({ reason: 'occupied-plant' });
      const row = await db.getRepository(Decoration).findOneByOrFail({ id });
      expect([row.lat, row.lon]).toEqual([0, 61]);
      expect((await stored()).version).toBe(4);
    });

    it('answers a decoration that is not on this planet with 404', async () => {
      const moved = await send('patch', `decorations/${ELSEWHERE}/position`, {
        lat: 0,
        lon: 0,
        expectedVersion: 1,
      }).expect(404);
      const putAway = await send('delete', `decorations/${ELSEWHERE}`, {
        expectedVersion: 1,
      }).expect(404);

      expect(moved.body).toMatchObject({ message: GONE });
      expect(putAway.body).toMatchObject({ message: GONE });
    });

    it('refuses a move to lat 91 with 400', async () => {
      const id = await placedPondId(0, 60);

      await send('patch', `decorations/${id}/position`, {
        lat: 91,
        lon: 0,
        expectedVersion: 2,
      }).expect(400);
    });
  });
});
