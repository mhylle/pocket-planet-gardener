import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { TUTORIAL_STEPS } from '../src/content/tutorial';
import type { CreatureIdentity } from '../src/creatures/identity.types';
import { InventoryService } from '../src/inventory/inventory.service';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { isAchievable } from '../src/wants/want-evaluator';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const T0 = '2030-01-01T00:00:00.000Z';
const MINUTE = 60;

/** The instant some seconds after T0, as X-Test-Now wants it. */
function at(seconds: number): string {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString();
}

// Syncs 30 s apart are live play (at most three sync intervals): each plant
// gets the light of the sun where it is.
const HEARTBEAT = 30;

// At T0 the sun stands over longitude 0 and drifts 6 degrees a minute. The
// first 15-minute slice takes its light at 7.5 minutes, with the sun over
// longitude 45: 55 degrees from there the light suits a clover (partial),
// on the far side it is too dark, one unmet need.
const SUNNY_SPOT = { lat: 0, lon: 100 };
const NIGHT_SPOT = { lat: 0, lon: -135 };

const WIGGLENUT: CreatureIdentity = {
  name: 'Wigglenut',
  traits: ['curious', 'cheerful'],
  quirk: 'Believes every pebble is a sleeping mountain.',
  speakingStyle: 'quick and bubbly, with lots of exclamations',
  backstory:
    'Wigglenut tunnelled up the moment the first clover opened. The soil here smelled far too lovely to leave.',
  summary: 'A cheerful worm who admires pebbles.',
};

// Five sunflowers need more seeds than the 2 a new planet holds, so the
// tutorial want refuses them; one more clover in bloom it can do.
const TOO_MANY_SUNFLOWERS = JSON.stringify({
  spec: { type: 'count-blooming', plant: 'sunflower', count: 5 },
  text: 'Five tall sunflowers would make lovely towers. Could you grow them?',
});
const CLOVER_WANT = {
  spec: { type: 'count-blooming', plant: 'clover', count: 2 },
  text: 'Two clovers in bloom would make my tunnel smell lovely. Could you?',
};

const REFUSED = "Pip can't go to that step from here.";

// Uses the dev database and empties the planets table and its children.
describe('Tutorial and first session (e2e)', () => {
  const ai = new FakeAiService();
  let app: INestApplication<App>;
  let db: DataSource;
  let planetId: string;
  let version: number;

  beforeAll(async () => {
    app = await bootWithFakeAi(ai);
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    ai.reset();
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', T0)
      .send({ name: 'Moonbeam' })
      .expect(201);
    const snapshot = created.body as PlanetSnapshotDto;
    expect(snapshot.tutorialStep).toBe(0);
    planetId = snapshot.id;
    version = snapshot.version;
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    await app.close();
  });

  async function getPlanet(): Promise<PlanetSnapshotDto> {
    const res = await request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', planetId)
      .expect(200);
    return res.body as PlanetSnapshotDto;
  }

  function patchStep(body: object) {
    return request(app.getHttpServer())
      .patch('/api/planet/tutorial')
      .set('X-Planet-Id', planetId)
      .send(body);
  }

  /** A garden command; keeps the version for the next one. */
  async function command(
    path: string,
    body: object,
    now: string,
  ): Promise<MutationResult> {
    const res = await request(app.getHttpServer())
      .post(`/api/garden/${path}`)
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ ...body, expectedVersion: version });
    expect(res.status).toBeLessThan(300);
    const result = res.body as MutationResult;
    version = result.snapshot.version;
    return result;
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

  /** Live syncs from one instant to another, both included. */
  async function play(
    from: number,
    to: number,
    step = HEARTBEAT,
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (let seconds = from; seconds <= to; seconds += step) {
      results.push(await sync(at(seconds)));
    }
    return results;
  }

  function eventsOf(result: SyncResult, type: string) {
    return result.events.filter((event) => event.type === type);
  }

  /** The starter clover planted at T0, then live play up to just before bloomAt. */
  async function growUntilJustBefore(
    spot: { lat: number; lon: number },
    bloomAt: number,
  ): Promise<void> {
    await command('plants', { itemType: 'clover', ...spot }, T0);
    for (const result of await play(HEARTBEAT, bloomAt - HEARTBEAT)) {
      expect(result.snapshot.plants[0].stage).not.toBe('bloom');
      expect(result.snapshot.creatures).toEqual([]);
    }
  }

  describe('GET /api/tutorial', () => {
    it("serves Pip's 8 steps in order, without a planet", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tutorial')
        .expect(200);

      expect(res.body).toEqual({ steps: TUTORIAL_STEPS });
      expect(
        (res.body as { steps: { id: string }[] }).steps.map((step) => step.id),
      ).toEqual([
        'welcome',
        'rotate',
        'open-inventory',
        'plant',
        'water',
        'move-sun',
        'inspect',
        'goodbye',
      ]);
    });
  });

  describe('PATCH /api/planet/tutorial', () => {
    it('keeps a later step, which the snapshot then shows (ONB-01 AC4)', async () => {
      expect((await getPlanet()).tutorialStep).toBe(0);

      const res = await patchStep({ step: 3 }).expect(200);

      expect(res.body).toEqual({ tutorialStep: 3 });
      expect((await getPlanet()).tutorialStep).toBe(3);
    });

    it('refuses going back, staying, a step past the last and a restart midway, with a friendly 400', async () => {
      await patchStep({ step: 3 }).expect(200);

      for (const step of [2, 3, 9, TUTORIAL_STEPS.length, 0]) {
        const res = await patchStep({ step });
        expect([step, res.status]).toEqual([step, 400]);
        expect(res.body).toMatchObject({ statusCode: 400, message: REFUSED });
      }
      expect((await getPlanet()).tutorialStep).toBe(3);
    });

    it("finishes from any step, then restarts at the first step from Pip's help button", async () => {
      await patchStep({ step: 3 }).expect(200);

      expect((await patchStep({ step: -1 }).expect(200)).body).toEqual({
        tutorialStep: -1,
      });
      expect((await getPlanet()).tutorialStep).toBe(-1);
      await patchStep({ step: 2 }).expect(400);
      expect((await patchStep({ step: 0 }).expect(200)).body).toEqual({
        tutorialStep: 0,
      });
      expect((await getPlanet()).tutorialStep).toBe(0);
    });

    it('accepts the last step, and is no command: the version stays and a sync still fits', async () => {
      await patchStep({ step: 3 }).expect(200);
      await patchStep({ step: TUTORIAL_STEPS.length - 1 }).expect(200);
      await patchStep({ step: -1 }).expect(200);
      await patchStep({ step: 0 }).expect(200);

      expect((await getPlanet()).version).toBe(version);
      await sync(at(10));
    });

    it('refuses a step that is not a whole number', async () => {
      for (const body of [{ step: 1.5 }, { step: '3' }, {}]) {
        await patchStep(body).expect(400);
      }
      expect((await getPlanet()).tutorialStep).toBe(0);
    });

    it('needs the X-Planet-Id header', async () => {
      await request(app.getHttpServer())
        .patch('/api/planet/tutorial')
        .send({ step: 1 })
        .expect(400);
    });
  });

  describe('first session (ONB-02)', () => {
    it('blooms the starter clover 5 minutes after planting it in good light, and the worm moves in at that sync with the identity the AI made (AC1, AC2)', async () => {
      await growUntilJustBefore(SUNNY_SPOT, 5 * MINUTE);
      ai.respondWith(JSON.stringify(WIGGLENUT));

      const result = await sync(at(5 * MINUTE));

      expect(result.snapshot.plants[0].stage).toBe('bloom');
      expect(eventsOf(result, 'plant-bloomed')).toEqual([
        expect.objectContaining({ occurredAt: at(5 * MINUTE) }),
      ]);
      // The planet's first creature needs no arrival delay.
      expect(result.snapshot.creatures).toEqual([
        expect.objectContaining({
          species: 'worm',
          name: WIGGLENUT.name,
          quirk: WIGGLENUT.quirk,
          identitySource: 'ai',
          arrivedAt: at(5 * MINUTE),
        }),
      ]);
      expect(
        eventsOf(result, 'creature-arrived').map((e) => e.payload.species),
      ).toEqual(['worm']);
    });

    it('blooms it within 10 minutes when the player follows Pip: 4 s of rain and the sun dragged onto it (AC1)', async () => {
      const planted = await command(
        'plants',
        { itemType: 'clover', ...SUNNY_SPOT },
        T0,
      );
      const cloudId = planted.snapshot.clouds[0].id;
      for (const seconds of [2, 2]) {
        await command('rain', { cloudId, ...SUNNY_SPOT, seconds }, T0);
      }
      const tended = await command('sun', { angle: SUNNY_SPOT.lon }, T0);
      // Soaked through, so soggy: one unmet need. Full light suits a clover.
      expect(tended.snapshot.plants[0].water).toBe(1);

      const results = await play(HEARTBEAT, 10 * MINUTE);

      expect(results[results.length - 1].snapshot.plants[0].stage).toBe(
        'bloom',
      );
    });

    it('blooms it within 10 minutes on the night side, with one need unmet, and the worm still moves in at once (AC1, AC2)', async () => {
      await growUntilJustBefore(NIGHT_SPOT, 10 * MINUTE);

      const result = await sync(at(10 * MINUTE));

      expect(result.snapshot.plants[0].stage).toBe('bloom');
      expect(
        result.snapshot.creatures?.map((creature) => creature.species),
      ).toEqual(['worm']);
    });

    it("gives the worm a first want at the next sync that the player's own seeds can meet (AC3)", async () => {
      await growUntilJustBefore(SUNNY_SPOT, 5 * MINUTE);
      ai.respondWith(JSON.stringify(WIGGLENUT));
      await sync(at(5 * MINUTE));
      ai.reset();
      ai.respondWith(TOO_MANY_SUNFLOWERS, JSON.stringify(CLOVER_WANT));

      const { snapshot } = await sync(at(5 * MINUTE + HEARTBEAT));

      const want = snapshot.creatures?.[0].want;
      // Asked as the tutorial want: the sunflowers were sent back.
      expect(ai.calls).toHaveLength(2);
      expect(want).toMatchObject(CLOVER_WANT);
      expect(
        isAchievable(want!.spec, {
          unlocked: new Set(snapshot.unlocks),
          maxPlants: snapshot.maxPlants,
          plantCount: snapshot.plants.length,
        }),
      ).toBe(true);
      // One clover blooms already; a clover seed held makes the second.
      const blooming = snapshot.plants.filter(
        (plant) => plant.type === 'clover' && plant.stage === 'bloom',
      ).length;
      const seeds = snapshot.inventory.find(
        (item) => item.itemType === 'clover',
      )?.count;
      expect(blooming).toBe(1);
      expect(seeds).toBeGreaterThanOrEqual(CLOVER_WANT.spec.count - blooming);
    });

    it('keeps the arrival delay for the next species', async () => {
      await growUntilJustBefore(SUNNY_SPOT, 5 * MINUTE);
      await sync(at(5 * MINUTE));
      // Past the 30 minutes between arrivals: a pond as a reward would
      // give it, and two more clovers, all three in bloom for the snail.
      const later = 40 * MINUTE;
      await db.transaction((em) =>
        app
          .get(InventoryService, { strict: false })
          .grant(
            em,
            planetId,
            [{ itemType: 'pond', kind: 'decoration', count: 1 }],
            new Date(at(later)),
          ),
      );
      await command(
        'decorations',
        { itemType: 'pond', lat: 20, lon: 110 },
        at(later),
      );
      for (const lon of [110, 120]) {
        await command('plants', { itemType: 'clover', lat: 0, lon }, at(later));
      }
      await db.query(
        `UPDATE "plants" SET "stage" = 'bloom', "growth" = 1 WHERE "planet_id" = $1`,
        [planetId],
      );

      // The condition holds from the first of these syncs, 20 s apart.
      for (const result of await play(later + 20, later + 2 * MINUTE, 20)) {
        expect(eventsOf(result, 'creature-arrived')).toEqual([]);
      }
      const result = await sync(at(later + 2 * MINUTE + 20));

      expect(
        result.snapshot.creatures?.map((creature) => creature.species),
      ).toEqual(['worm', 'snail']);
    });
  });
});
