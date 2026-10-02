import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Plant } from '../src/garden/plant.entity';
import type { RainResult } from '../src/garden/garden.service';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { Planet } from '../src/planets/planet.entity';
import { waterStatus } from '../src/simulation/growth-rules';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// On the 15-minute grid, where the default 60-minute sun day starts at 0.
const CREATED = '2030-01-01T00:00:00.000Z';
const SPOT = { lat: 10, lon: 20 };
const GONE = "That isn't on your planet any more.";
// With the defaults: 8 seconds of rain in a full cloud, 0.15 water a second.
const RAIN_SECONDS = 8;
const WATER_PER_SECOND = 0.15;

/** The ISO time some seconds after CREATED. */
function after(seconds: number): string {
  return new Date(Date.parse(CREATED) + seconds * 1000).toISOString();
}

// Uses the dev database and empties the planets table and its children.
describe('Clouds and sun (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let planetId: string;
  let version: number;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', CREATED)
      .send({ name: 'Moonbeam' })
      .expect(201);
    planetId = (created.body as PlanetSnapshotDto).id;
    version = 1;
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  /** Sends a garden command at the current version and keeps the new one. */
  async function command<T = MutationResult>(
    path: string,
    body: object,
    now: string,
    status = 200,
  ): Promise<T> {
    const res = await request(app.getHttpServer())
      .post(`/api/garden/${path}`)
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ ...body, expectedVersion: version })
      .expect(status);
    if (status < 300) {
      version = (res.body as MutationResult).snapshot.version;
    }
    return res.body as T;
  }

  async function plantClover(spot: { lat: number; lon: number }) {
    const { snapshot } = await command(
      'plants',
      { itemType: 'clover', ...spot },
      CREATED,
      201,
    );
    // Planted at the same instant, plants are served in id order.
    const plant = snapshot.plants.find(
      ({ lat, lon }) => lat === spot.lat && lon === spot.lon,
    );
    return plant!.id;
  }

  function rain(body: object, now = CREATED, status = 200) {
    return command<RainResult>('rain', body, now, status);
  }

  async function sync(now: string): Promise<SyncResult> {
    const res = await request(app.getHttpServer())
      .post('/api/planet/sync')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ expectedVersion: version })
      .expect(200);
    return res.body as SyncResult;
  }

  function getSnapshot(now: string) {
    return request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .expect(200)
      .then((res) => res.body as PlanetSnapshotDto);
  }

  function setWater(plantId: string, water: number) {
    return db.query('UPDATE "plants" SET "water" = $1 WHERE "id" = $2', [
      water,
      plantId,
    ]);
  }

  async function waterOf(plantId: string): Promise<number> {
    const plant = await db
      .getRepository(Plant)
      .findOneByOrFail({ id: plantId });
    return plant.water;
  }

  async function storedVersion(): Promise<number> {
    const planet = await db
      .getRepository(Planet)
      .findOneByOrFail({ id: planetId });
    return planet.version;
  }

  describe('clouds', () => {
    it('gives a new planet three full clouds, spread round it, at its first sync', async () => {
      expect((await getSnapshot(CREATED)).clouds).toEqual([]);

      const { snapshot } = await sync(CREATED);

      expect(snapshot.clouds).toEqual([
        { id: 'cloud-1', lat: 25, lon: 0, water: 1, at: CREATED },
        { id: 'cloud-2', lat: -15, lon: 120, water: 1, at: CREATED },
        { id: 'cloud-3', lat: 40, lon: -120, water: 1, at: CREATED },
      ]);
      // A sync is still not a change (Task 3.4).
      expect(snapshot.version).toBe(1);
    });

    it('stores the clouds as they are at every sync, drifting east', async () => {
      await sync(CREATED);

      const { snapshot } = await sync(after(60));

      expect(snapshot.clouds[0]).toEqual({
        id: 'cloud-1',
        lat: 25,
        lon: 6,
        water: 1,
        at: after(60),
      });
    });

    it('carries a released cloud on drifting from where it was let go (GRD-02 AC3)', async () => {
      await sync(CREATED);
      const release = after(600);

      const moved = await command(
        'clouds/cloud-2/position',
        { lat: -30, lon: 100 },
        release,
      );
      const { snapshot } = await sync(after(600 + 120));

      expect(moved.snapshot.clouds[1]).toEqual({
        id: 'cloud-2',
        lat: -30,
        lon: 100,
        water: 1,
        at: release,
      });
      // Two minutes at 6 degrees a minute.
      expect(snapshot.clouds[1]).toMatchObject({ lat: -30, lon: 112 });
      expect(moved.snapshot.version).toBe(2);
    });

    it('answers 404 for a cloud the planet does not have, changing nothing', async () => {
      const res = await command(
        'clouds/cloud-9/position',
        { lat: 0, lon: 0 },
        CREATED,
        404,
      );

      expect(res).toMatchObject({ message: GONE });
      expect(await storedVersion()).toBe(1);
    });

    it('refuses a position off the planet', async () => {
      await command(
        'clouds/cloud-1/position',
        { lat: 91, lon: 0 },
        CREATED,
        400,
      );
    });
  });

  describe('POST /api/garden/rain', () => {
    it('raises the water of a thirsty plant under the cloud and drains the cloud (GRD-02 AC1)', async () => {
      const plantId = await plantClover(SPOT);
      await setWater(plantId, 0.05);

      const result = await rain({ cloudId: 'cloud-1', ...SPOT, seconds: 1 });

      expect(result.cloudEmpty).toBe(false);
      const plant = result.snapshot.plants.find(({ id }) => id === plantId);
      expect(plant?.water).toBeCloseTo(0.05 + WATER_PER_SECOND, 12);
      expect(await waterOf(plantId)).toBeCloseTo(0.2, 12);
      // The cloud is where it was held, with an eighth of its water gone.
      expect(result.snapshot.clouds[0]).toEqual({
        id: 'cloud-1',
        ...SPOT,
        water: 1 - 1 / RAIN_SECONDS,
        at: CREATED,
      });
      expect(result.snapshot.version).toBe(3);
    });

    it('takes a thirsty plant back to happy within a few seconds of rain (GRD-06 AC2)', async () => {
      const plantId = await plantClover(SPOT);
      await setWater(plantId, 0.05);
      expect(waterStatus(await waterOf(plantId))).toBe('thirsty');

      await rain({ cloudId: 'cloud-1', ...SPOT, seconds: 1 }, after(1));
      const { snapshot } = await rain(
        { cloudId: 'cloud-1', ...SPOT, seconds: 1 },
        after(2),
      );

      expect(waterStatus(await waterOf(plantId))).toBe('happy');
      // It keeps the stage it had reached.
      expect(snapshot.plants[0].stage).toBe('seed');
    });

    it('waters only the plants within the rain radius', async () => {
      const under = await plantClover(SPOT);
      // 1.8 steps away, inside the 2-step radius.
      const near = await plantClover({ lat: 10, lon: 29 });
      // 4 steps away.
      const far = await plantClover({ lat: 10, lon: 40 });
      for (const plantId of [under, near, far]) {
        await setWater(plantId, 0.2);
      }

      await rain({ cloudId: 'cloud-3', ...SPOT, seconds: 2 });

      expect(await waterOf(under)).toBeCloseTo(0.5, 12);
      expect(await waterOf(near)).toBeCloseTo(0.5, 12);
      expect(await waterOf(far)).toBe(0.2);
    });

    it('never fills a plant beyond 1', async () => {
      const plantId = await plantClover(SPOT);
      await setWater(plantId, 0.9);

      await rain({ cloudId: 'cloud-1', ...SPOT, seconds: 2 });

      expect(await waterOf(plantId)).toBe(1);
    });

    it('rests an emptied cloud while it refills, then rains again (GRD-02 AC2)', async () => {
      const plantId = await plantClover(SPOT);
      // An identical plant out of the rain shows what time alone does.
      const control = await plantClover({ lat: 10, lon: 40 });
      const spell = { cloudId: 'cloud-2', ...SPOT, seconds: 2 };
      for (let i = 0; i < RAIN_SECONDS / 2; i++) {
        expect((await rain(spell)).cloudEmpty).toBe(false);
      }
      await setWater(plantId, 0.05);
      await setWater(control, 0.05);

      // Held on through most of the 12 seconds it takes to refill to 0.2.
      for (const second of [0, 3, 6, 9, 11]) {
        const empty = await rain({ ...spell, seconds: 1 }, after(second));

        expect(empty.cloudEmpty).toBe(true);
        expect(empty.snapshot.clouds[1]).toMatchObject(SPOT);
        expect(empty.snapshot.clouds[1].water).toBeLessThan(0.2);
        expect(await waterOf(plantId)).toBe(await waterOf(control));
      }

      const refilled = await rain({ ...spell, seconds: 1 }, after(13));

      expect(refilled.cloudEmpty).toBe(false);
      expect(await waterOf(plantId)).toBeCloseTo(
        (await waterOf(control)) + WATER_PER_SECOND,
        12,
      );
    });

    it.each([
      ['3 seconds', { seconds: 3 }],
      ['0 seconds', { seconds: 0 }],
      ['no cloud id', { cloudId: undefined }],
      ['a spot off the planet', { lat: -91 }],
    ])('refuses %s, changing nothing', async (_case, change) => {
      const plantId = await plantClover(SPOT);
      await setWater(plantId, 0.05);

      await rain(
        { cloudId: 'cloud-1', ...SPOT, seconds: 1, ...change },
        CREATED,
        400,
      );

      expect(await waterOf(plantId)).toBe(0.05);
      expect(await storedVersion()).toBe(2);
    });

    it('answers 404 for an unknown cloud', async () => {
      const res = await rain(
        { cloudId: 'cloud-9', ...SPOT, seconds: 1 },
        CREATED,
        404,
      );

      expect(res).toMatchObject({ message: GONE });
    });
  });

  describe('POST /api/garden/sun', () => {
    it('holds the sun where it was dragged, then lets it drift on (GRD-03 AC1, AC2)', async () => {
      const dragged = after(600);

      const { snapshot } = await command('sun', { angle: 200 }, dragged);

      expect(snapshot.sun).toEqual({
        overrideAngle: 200,
        overrideAt: dragged,
        angle: 200,
      });
      expect(snapshot.version).toBe(2);
      // Still held four minutes later...
      expect((await getSnapshot(after(600 + 240))).sun.angle).toBe(200);
      // ...and drifting 6 degrees a minute once the 5-minute hold is over.
      const drifting = await sync(after(600 + 360));
      expect(drifting.snapshot.sun.angle).toBeCloseTo(206, 9);
    });

    it.each([360, -1, 'noon'])('refuses the angle %p', async (angle) => {
      await command('sun', { angle }, CREATED, 400);

      expect(await storedVersion()).toBe(1);
    });
  });
});
