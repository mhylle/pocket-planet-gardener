import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const CREATED = '2030-01-01T00:00:00.000Z';
const LATER = '2030-01-01T00:10:00.000Z';
const LATEST = '2030-01-01T00:20:00.000Z';

// Uses the dev database and empties the planets table and its children.
describe('POST /api/planet/sync (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let planetId: string;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    const res = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', CREATED)
      .send({ name: 'Moonbeam' })
      .expect(201);
    planetId = (res.body as PlanetSnapshotDto).id;
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  function sync(body: object, now = LATER, id = planetId) {
    return request(app.getHttpServer())
      .post('/api/planet/sync')
      .set('X-Planet-Id', id)
      .set('X-Test-Now', now)
      .send(body);
  }

  function storedPlanet(): Promise<Planet> {
    return db.getRepository(Planet).findOneByOrFail({ id: planetId });
  }

  it('answers the current version with 200, the snapshot and no events, and keeps the version', async () => {
    const res = await sync({ expectedVersion: 1 }).expect(200);
    const result = res.body as SyncResult;

    expect(Object.keys(result).sort()).toEqual([
      'events',
      'newlyUnlocked',
      'snapshot',
    ]);
    expect(result.snapshot).toMatchObject({
      id: planetId,
      name: 'Moonbeam',
      version: 1,
      serverTime: LATER,
    });
    expect(result.events).toEqual([]);
    expect((await storedPlanet()).version).toBe(1);
  });

  it('lets two heartbeats on the same version both through', async () => {
    await sync({ expectedVersion: 1 }).expect(200);
    await sync({ expectedVersion: 1 }).expect(200);

    expect((await storedPlanet()).version).toBe(1);
  });

  it('lets two heartbeats sent at once on the same version both through', async () => {
    const responses = await Promise.all([
      sync({ expectedVersion: 1 }),
      sync({ expectedVersion: 1 }),
    ]);

    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    expect((await storedPlanet()).version).toBe(1);
  });

  it('moves last_seen_at forward to the time of each sync', async () => {
    expect((await storedPlanet()).lastSeenAt.toISOString()).toBe(CREATED);

    await sync({ expectedVersion: 1 }, LATER).expect(200);
    expect((await storedPlanet()).lastSeenAt.toISOString()).toBe(LATER);

    await sync({ expectedVersion: 1 }, LATEST).expect(200);
    expect((await storedPlanet()).lastSeenAt.toISOString()).toBe(LATEST);
  });

  it('refuses a stale version with 409 reload and records no visit (ACC-04 AC2)', async () => {
    // Another tab's command moved the planet on.
    await db.getRepository(Planet).update(planetId, { version: 2 });

    const res = await sync({ expectedVersion: 1 }).expect(409);

    expect(res.body).toMatchObject({ message: 'reload' });
    const row = await storedPlanet();
    expect(row.version).toBe(2);
    expect(row.lastSeenAt.toISOString()).toBe(CREATED);
  });

  it('needs the X-Planet-Id header', async () => {
    await request(app.getHttpServer())
      .post('/api/planet/sync')
      .send({ expectedVersion: 1 })
      .expect(400);
  });

  it('answers an unknown planet with 404', async () => {
    const res = await sync(
      { expectedVersion: 1 },
      LATER,
      '00000000-0000-4000-8000-000000000000',
    ).expect(404);

    expect(res.body).toMatchObject({
      message: 'This planet has drifted away',
    });
  });

  it.each([
    ['a version of 0', { expectedVersion: 0 }],
    ['a version that is not a number', { expectedVersion: 'x' }],
    ['a version that is not whole', { expectedVersion: 1.5 }],
    ['no version', {}],
    ['an extra property', { expectedVersion: 1, force: true }],
  ])('refuses a body with %s', async (_case, body) => {
    await sync(body).expect(400);

    expect((await storedPlanet()).lastSeenAt.toISOString()).toBe(CREATED);
  });
});
