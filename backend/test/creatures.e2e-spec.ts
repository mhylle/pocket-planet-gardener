import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { SpeciesId } from '../src/content/content.types';
import { FALLBACK_IDENTITIES } from '../src/content/fallback-identities';
import { Creature } from '../src/creatures/creature.entity';
import type { CreatureIdentity } from '../src/creatures/identity.types';
import { PlanetEvent } from '../src/events/event.entity';
import { InventoryService } from '../src/inventory/inventory.service';
import type {
  CreatureDto,
  PlanetSnapshotDto,
} from '../src/planets/dto/planet-snapshot.dto';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { stepsBetween } from '../src/simulation/surface-coords';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const T0 = '2030-01-01T00:00:00.000Z';
const HOUR = 3600;
const DAY = 24 * HOUR;

/** The instant some seconds after T0, as X-Test-Now wants it. */
function at(seconds: number): string {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString();
}

const CLOVER_SPOTS = [
  { lat: 0, lon: 0 },
  { lat: 0, lon: 10 },
  { lat: 0, lon: 20 },
];
const POND_SPOT = { lat: 20, lon: 10 };

/** A valid identity, as the model would answer it. */
const SHELLY: CreatureIdentity = {
  name: 'Shelly',
  traits: ['patient', 'tidy'],
  quirk: 'She polishes her shell every morning until it shines.',
  speakingStyle: 'slow and gentle, with long pauses',
  backstory:
    'Shelly followed the scent of clover across the meadow. She liked the pond so much that she decided to stay.',
  summary: 'A tidy snail who loves a shiny shell.',
};

const WORM_NAMES = FALLBACK_IDENTITIES.worm.map((identity) => identity.name);

// Uses the dev database and empties the planets table and its children.
describe('Creatures (e2e)', () => {
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
    planetId = snapshot.id;
    version = snapshot.version;
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    await app.close();
  });

  /** A garden command; keeps the version for the next one. */
  async function command(
    method: 'post' | 'delete',
    path: string,
    body: object,
    now = T0,
  ): Promise<MutationResult> {
    const res = await request(app.getHttpServer())
      [method](`/api/garden/${path}`)
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
    expect(res.body).not.toHaveProperty('error');
    return res.body as SyncResult;
  }

  async function plantClovers(spots = CLOVER_SPOTS): Promise<MutationResult[]> {
    const results: MutationResult[] = [];
    for (const spot of spots) {
      results.push(
        await command('post', 'plants', { itemType: 'clover', ...spot }),
      );
    }
    return results;
  }

  /** A pond into the inventory, as a reward would give it, then placed. */
  async function placePond(): Promise<void> {
    const inventory = app.get(InventoryService, { strict: false });
    await db.transaction((em) =>
      inventory.grant(
        em,
        planetId,
        [{ itemType: 'pond', kind: 'decoration', count: 1 }],
        new Date(T0),
      ),
    );
    await command('post', 'decorations', { itemType: 'pond', ...POND_SPOT });
  }

  /** Every plant straight into bloom, as if it had grown there. */
  function bloomAll(): Promise<unknown> {
    return db.query(
      `UPDATE "plants" SET "stage" = 'bloom', "growth" = 1 WHERE "planet_id" = $1`,
      [planetId],
    );
  }

  /** Creatures that moved in earlier, far from the garden. */
  async function moveIn(...species: SpeciesId[]): Promise<void> {
    await db.getRepository(Creature).insert(
      species.map((each, i) => ({
        planetId,
        species: each,
        name: `Resident ${i + 1}`,
        identity: {
          traits: ['calm', 'kind'],
          quirk: 'It hums.',
          speakingStyle: 'softly',
          backstory: 'It has lived here a while.',
          summary: 'A calm resident.',
        },
        identitySource: 'ai' as const,
        moodSince: new Date(T0),
        lat: -60,
        lon: i * 30,
        arrivedAt: new Date(T0),
      })),
    );
  }

  function arrivals(result: SyncResult) {
    return result.events.filter((event) => event.type === 'creature-arrived');
  }

  it('serves a new planet with no creatures', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', planetId)
      .expect(200);

    expect((res.body as PlanetSnapshotDto).creatures).toEqual([]);
  });

  it('moves a snail in 2 minutes after 3 clovers bloom by a pond, with the identity the AI made (CRT-01 AC1)', async () => {
    // The worm lives here already, so the snail is next in line.
    await moveIn('worm');
    await plantClovers();
    await placePond();
    await bloomAll();

    // Syncs 20 s apart are live play; the condition holds from the first.
    // The first also gives the worm its want (Phase 12).
    for (let seconds = 20; seconds <= 120; seconds += 20) {
      const early = await sync(at(seconds));
      expect(arrivals(early)).toEqual([]);
      expect(early.snapshot.creatures).toHaveLength(1);
    }
    ai.reset();
    ai.respondWith(JSON.stringify(SHELLY));
    const result = await sync(at(140));

    const snail = result.snapshot.creatures?.[1];
    expect(snail).toEqual({
      id: expect.any(String) as unknown,
      species: 'snail',
      name: SHELLY.name,
      summary: SHELLY.summary,
      traits: SHELLY.traits,
      quirk: SHELLY.quirk,
      speakingStyle: SHELLY.speakingStyle,
      backstory: SHELLY.backstory,
      mood: 'content',
      wistful: false,
      lat: expect.any(Number) as unknown,
      lon: expect.any(Number) as unknown,
      arrivedAt: at(140),
      identitySource: 'ai',
      // Its first want comes at the next sync (Phase 12).
      want: null,
    } satisfies Record<keyof CreatureDto, unknown>);
    // At home beside the pond that drew it, clear of the water.
    expect(stepsBetween(snail!, POND_SPOT)).toBeGreaterThanOrEqual(2);
    expect(stepsBetween(snail!, POND_SPOT)).toBeLessThan(4);
    expect(ai.calls).toHaveLength(1);

    const fact = {
      type: 'creature-arrived',
      occurredAt: at(140),
      payload: {
        creatureId: snail!.id,
        species: 'snail',
        name: SHELLY.name,
        lat: snail!.lat,
        lon: snail!.lon,
        milestone: true,
      },
    };
    expect(arrivals(result)).toEqual([fact]);
    const logged = await db
      .getRepository(PlanetEvent)
      .findOneByOrFail({ planetId, type: 'creature-arrived' });
    expect(logged).toMatchObject({ payload: fact.payload, isMilestone: true });
  });

  it('moves the worm in first, the snail only 30 minutes later, and no second worm (CRT-01 AC3)', async () => {
    await plantClovers();
    await placePond();
    await bloomAll();

    const first = await sync(at(HOUR));
    expect(arrivals(first).map((event) => event.payload.species)).toEqual([
      'worm',
    ]);
    // Away time, but too soon after the worm.
    expect(arrivals(await sync(at(HOUR + 29 * 60)))).toEqual([]);
    const later = await sync(at(HOUR + 30 * 60));

    expect(arrivals(later).map((event) => event.payload.species)).toEqual([
      'snail',
    ]);
    expect(
      later.snapshot.creatures?.map((creature) => creature.species),
    ).toEqual(['worm', 'snail']);
    // The first bloom brings one worm; the next snail is the last one.
    expect(
      arrivals(await sync(at(HOUR + 60 * 60))).map((e) => e.payload.species),
    ).toEqual(['snail']);
    expect(arrivals(await sync(at(5 * HOUR)))).toEqual([]);
  });

  it('finds the worm moved in after a first bloom while away, and says so on return (TIM-01 AC2)', async () => {
    await plantClovers([CLOVER_SPOTS[0]]);

    // The clover blooms during the catch-up; away time needs no delay.
    const result = await sync(at(3 * HOUR));

    const worms = result.snapshot.creatures ?? [];
    expect(worms.map((creature) => creature.species)).toEqual(['worm']);
    expect(worms[0].arrivedAt).toBe(at(3 * HOUR));
    expect(result.welcomeBack?.summary).toEqual([
      expect.objectContaining({ kind: 'blooms', text: '1 plant bloomed' }),
      {
        kind: 'creatures',
        count: 1,
        text: '1 new creature',
        focus: { lat: worms[0].lat, lon: worms[0].lon },
      },
    ]);
  });

  it('gives a pre-written identity when the AI fails, and the player sees no error (CRT-03 AC4)', async () => {
    ai.failure = new Error('model unavailable');
    await plantClovers([CLOVER_SPOTS[0]]);

    const result = await sync(at(3 * HOUR));

    const [worm] = result.snapshot.creatures ?? [];
    expect(worm).toMatchObject({ species: 'worm', identitySource: 'fallback' });
    expect(WORM_NAMES).toContain(worm.name);
    const usage = await db.query<{ feature: string; used_fallback: boolean }[]>(
      `SELECT "feature", "used_fallback" FROM "ai_usage" WHERE "planet_id" = $1 AND "feature" = 'identity'`,
      [planetId],
    );
    expect(usage).toEqual([{ feature: 'identity', used_fallback: true }]);
  });

  it('keeps every creature unchanged after 30 days away, even with the bloom it came for dug up (CRT-05)', async () => {
    const [planted] = await plantClovers([CLOVER_SPOTS[0]]);
    const before = (await sync(at(3 * HOUR))).snapshot.creatures;
    expect(before).toHaveLength(1);
    await command(
      'delete',
      `plants/${planted.snapshot.plants[0].id}`,
      {},
      at(3 * HOUR),
    );

    const after = await sync(at(30 * DAY));

    // Wistful now, with the want it got meanwhile (Phase 12), but unchanged.
    expect(after.snapshot.creatures).toEqual(
      before?.map((creature) => ({
        ...creature,
        wistful: true,
        want: expect.any(Object) as unknown,
      })),
    );
    expect(await db.getRepository(Creature).countBy({ planetId })).toBe(1);
  });

  it('lets no creature move in on a planet with 8 (CRT-02 AC1)', async () => {
    await moveIn(
      'bee',
      'bee',
      'moth',
      'moth',
      'hedgehog',
      'hedgehog',
      'frog',
      'frog',
    );
    await plantClovers([CLOVER_SPOTS[0]]);

    const result = await sync(at(3 * HOUR));

    expect(arrivals(result)).toEqual([]);
    expect(result.snapshot.creatures).toHaveLength(8);
    // No identity was asked for; the residents' wants are Phase 12's.
    const identities = await db.query<unknown[]>(
      `SELECT 1 FROM "ai_usage" WHERE "planet_id" = $1 AND "feature" = 'identity'`,
      [planetId],
    );
    expect(identities).toEqual([]);
  });

  it('removes the creatures with their planet (ACC-05)', async () => {
    await moveIn('worm', 'snail');

    await request(app.getHttpServer())
      .delete('/api/planet')
      .set('X-Planet-Id', planetId)
      .send({ confirm: 'DELETE' })
      .expect(204);

    expect(await db.getRepository(Creature).count()).toBe(0);
  });
});
