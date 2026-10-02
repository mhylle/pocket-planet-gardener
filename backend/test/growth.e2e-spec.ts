import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// On the 15-minute grid, where the default 60-minute sun day starts at 0.
const CREATED = '2030-01-01T00:00:00.000Z';
const SPOT = { lat: 10, lon: 20 };

function isPlantEvent(event: { type: string }): boolean {
  return event.type.startsWith('plant-');
}

// Uses the dev database and empties the planets table and its children.
describe('Growth and away catch-up (e2e)', () => {
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
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', CREATED)
      .send({ name: 'Moonbeam' })
      .expect(201);
    planetId = (created.body as PlanetSnapshotDto).id;
    const planted = await request(app.getHttpServer())
      .post('/api/garden/plants')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', CREATED)
      .send({ itemType: 'sunflower', ...SPOT, expectedVersion: 1 })
      .expect(201);
    plantId = (planted.body as MutationResult).snapshot.plants[0].id;
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  async function sync(now: string): Promise<SyncResult> {
    const res = await request(app.getHttpServer())
      .post('/api/planet/sync')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ expectedVersion: 2 })
      .expect(200);
    return res.body as SyncResult;
  }

  function storedPlanet(): Promise<Planet> {
    return db.getRepository(Planet).findOneByOrFail({ id: planetId });
  }

  it('blooms a 2-hour sunflower found 3 hours later, and says when (TIM-01 AC1)', async () => {
    const now = '2030-01-01T03:00:00.000Z';

    const { snapshot, events } = await sync(now);

    expect(snapshot.plants).toHaveLength(1);
    expect(snapshot.plants[0]).toMatchObject({
      id: plantId,
      stage: 'bloom',
      growth: 1,
      harvestReady: true,
    });
    // The worm the first bloom brings is test/creatures.e2e-spec.ts's.
    expect(events.filter(isPlantEvent)).toEqual([
      {
        type: 'plant-stage',
        occurredAt: '2030-01-01T00:40:00.000Z',
        payload: { plantId, type: 'sunflower', stage: 'sprout' },
      },
      {
        type: 'plant-stage',
        occurredAt: '2030-01-01T01:20:00.000Z',
        payload: { plantId, type: 'sunflower', stage: 'young' },
      },
      {
        type: 'plant-bloomed',
        occurredAt: '2030-01-01T02:00:00.000Z',
        payload: { plantId, type: 'sunflower', ...SPOT },
      },
    ]);
    const planet = await storedPlanet();
    expect(planet.lastSimulatedAt.toISOString()).toBe(now);
    // A sync never counts as a change (Task 3.4).
    expect(planet.version).toBe(2);
  });

  it('keeps the plant through 40 days away, thirsty, and simulates only 7 (TIM-02)', async () => {
    const now = '2030-02-10T00:00:00.000Z';

    const { snapshot, events } = await sync(now);

    expect(snapshot.plants).toHaveLength(1);
    expect(snapshot.plants[0]).toMatchObject({
      id: plantId,
      stage: 'bloom',
      water: 0,
    });
    expect(events.map((event) => event.type)).toContain('plant-bloomed');
    for (const event of events.filter(isPlantEvent)) {
      expect(event.occurredAt <= '2030-01-08T00:00:00.000Z').toBe(true);
    }
    expect((await storedPlanet()).lastSimulatedAt.toISOString()).toBe(now);
  });

  it('grows under the real sun while the player is here', async () => {
    // 10 seconds is within three heartbeats, so live: the sun is over lon 45
    // in the middle of the first slice, which lights this spot well.
    const { snapshot, events } = await sync('2030-01-01T00:00:10.000Z');

    expect(snapshot.plants[0].stage).toBe('seed');
    expect(snapshot.plants[0].growth).toBeCloseTo(10 / 60 / 120, 12);
    expect(events).toEqual([]);
  });

  it('serves where the sun is (GRD-03)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', '2030-01-01T00:15:00.000Z')
      .expect(200);

    expect((res.body as PlanetSnapshotDto).sun).toEqual({
      overrideAngle: null,
      overrideAt: null,
      angle: 90,
    });
    expect((await sync('2030-01-01T00:45:00.000Z')).snapshot.sun.angle).toBe(
      270,
    );
  });
});
