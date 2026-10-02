import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { PlanetEvent } from '../src/events/event.entity';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// On the 15-minute grid; a sunflower planted then blooms at 02:00 under
// away-time light (test/growth.e2e-spec.ts).
const CREATED = '2030-01-01T00:00:00.000Z';
const SPOT = { lat: 10, lon: 20 };
const OTHER_SPOT = { lat: -30, lon: 100 };

// The first bloom also brings the worm, at the sync that finds the bloom
// (Phase 11, test/creatures.e2e-spec.ts).
const BLOOM_AND_WORM = [
  { kind: 'blooms', count: 1, text: '1 plant bloomed', focus: SPOT },
  {
    kind: 'creatures',
    count: 1,
    text: '1 new creature',
    focus: expect.any(Object) as unknown,
  },
];

// Uses the dev database and empties the planets table and its children.
describe('Event log and welcome-back summary (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let planetId: string;

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
    await plant(SPOT, CREATED, 1);
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  async function plant(
    spot: { lat: number; lon: number },
    now: string,
    expectedVersion: number,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/garden/plants')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ itemType: 'sunflower', ...spot, expectedVersion })
      .expect(201);
  }

  async function sync(now: string, expectedVersion = 2): Promise<SyncResult> {
    const res = await request(app.getHttpServer())
      .post('/api/planet/sync')
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ expectedVersion })
      .expect(200);
    return res.body as SyncResult;
  }

  function storedEvents(): Promise<PlanetEvent[]> {
    return db.getRepository(PlanetEvent).find({
      where: { planetId },
      order: { occurredAt: 'ASC' },
    });
  }

  describe('event log (Task 9.1)', () => {
    it('stores a bloom found by a sync, dated inside the away interval, as the first-bloom milestone', async () => {
      await sync('2030-01-01T03:00:00.000Z');

      const events = await storedEvents();
      expect(
        events.map((event) => [
          event.type,
          event.occurredAt.toISOString(),
          event.isMilestone,
        ]),
      ).toEqual([
        ['plant-stage', '2030-01-01T00:40:00.000Z', false],
        ['plant-stage', '2030-01-01T01:20:00.000Z', false],
        ['plant-bloomed', '2030-01-01T02:00:00.000Z', true],
        ['creature-arrived', '2030-01-01T03:00:00.000Z', true],
      ]);
      expect(events[2].payload).toEqual({
        plantId: expect.any(String) as unknown,
        type: 'sunflower',
        ...SPOT,
      });
    });

    it('does not mark the second bloom as a milestone', async () => {
      await sync('2030-01-01T03:00:00.000Z');
      await plant(OTHER_SPOT, '2030-01-01T03:00:00.000Z', 2);
      await sync('2030-01-01T06:00:00.000Z', 3);

      const blooms = (await storedEvents()).filter(
        (event) => event.type === 'plant-bloomed',
      );
      expect(
        blooms.map((event) => [
          event.occurredAt.toISOString(),
          event.isMilestone,
        ]),
      ).toEqual([
        ['2030-01-01T02:00:00.000Z', true],
        ['2030-01-01T05:00:00.000Z', false],
      ]);
    });

    it('removes the planet events with the planet (ACC-05)', async () => {
      await sync('2030-01-01T03:00:00.000Z');
      expect(await storedEvents()).toHaveLength(4);

      await request(app.getHttpServer())
        .delete('/api/planet')
        .set('X-Planet-Id', planetId)
        .send({ confirm: 'DELETE' })
        .expect(204);

      expect(await db.getRepository(PlanetEvent).count()).toBe(0);
    });
  });

  describe('welcome-back summary (Task 9.3)', () => {
    it('lists the bloom on return 3 hours later (TIM-03 AC1)', async () => {
      const result = await sync('2030-01-01T03:00:00.000Z');

      expect(Object.keys(result).sort()).toEqual([
        'events',
        'snapshot',
        'welcomeBack',
      ]);
      expect(result.welcomeBack).toEqual({ summary: BLOOM_AND_WORM });
    });

    it('says nothing on a sync 10 minutes after the previous one, even about a bloom (AC2)', async () => {
      // Sprout and young only: not news, so no summary either.
      expect(await sync('2030-01-01T01:55:00.000Z')).not.toHaveProperty(
        'welcomeBack',
      );

      const result = await sync('2030-01-01T02:05:00.000Z');

      expect(result.events.map((event) => event.type)).toEqual([
        'plant-bloomed',
        'creature-arrived',
      ]);
      expect(result).not.toHaveProperty('welcomeBack');
    });

    it('says nothing 3 hours later when nothing happened since the last visit (AC2)', async () => {
      expect((await sync('2030-01-01T03:00:00.000Z')).welcomeBack).toEqual({
        summary: BLOOM_AND_WORM,
      });

      const result = await sync('2030-01-01T06:00:00.000Z');

      expect(result.events).toEqual([]);
      expect(result).not.toHaveProperty('welcomeBack');
    });

    it('leaves GET /api/planet as it was', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/planet')
        .set('X-Planet-Id', planetId)
        .set('X-Test-Now', '2030-01-01T03:00:00.000Z')
        .expect(200);

      expect(res.body).not.toHaveProperty('welcomeBack');
      // A GET is no visit: the sync after it still welcomes the player back.
      expect((await sync('2030-01-01T03:00:00.000Z')).welcomeBack).toEqual({
        summary: BLOOM_AND_WORM,
      });
    });
  });
});
