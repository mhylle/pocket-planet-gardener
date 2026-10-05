import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { SpeciesId } from '../src/content/content.types';
import { THANK_YOU_LINES } from '../src/content/thank-you-lines';
import { CreatureMemory } from '../src/creatures/creature-memory.entity';
import { Creature } from '../src/creatures/creature.entity';
import { PlanetEvent } from '../src/events/event.entity';
import type { GrantItem } from '../src/inventory/inventory.service';
import { InventoryService } from '../src/inventory/inventory.service';
import type {
  CreatureDto,
  InventoryItemDto,
  PlanetSnapshotDto,
} from '../src/planets/dto/planet-snapshot.dto';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { Want } from '../src/wants/want.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const T0 = '2030-01-01T00:00:00.000Z';
const MINUTE = 60;
const HOUR = 60 * MINUTE;
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

const WANT_TEXT =
  'Two clovers in bloom would make my tunnel smell lovely. Could you?';
/** A valid tutorial want, as the model would answer it: one more clover. */
const WANT_REPLY = JSON.stringify({
  spec: { type: 'count-blooming', plant: 'clover', count: 2 },
  text: WANT_TEXT,
});
const TUTORIAL_LINE = "This is the creature's very first wish";

// Uses the dev database and empties the planets table and its children.
describe('Wants, rewards and mood (e2e)', () => {
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
    ({ id: planetId, version } = await createPlanet());
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    await app.close();
  });

  async function createPlanet(): Promise<PlanetSnapshotDto> {
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', T0)
      .send({ name: 'Moonbeam' })
      .expect(201);
    return created.body as PlanetSnapshotDto;
  }

  /** A command under /api; keeps the version for the next one. */
  async function command(
    method: 'post' | 'delete',
    path: string,
    body: object,
    now: string,
  ): Promise<MutationResult> {
    const res = await request(app.getHttpServer())
      [method](`/api/${path}`)
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

  function maybeLater(wantId: string, now: string, planet = planetId) {
    return request(app.getHttpServer())
      .post(`/api/wants/${wantId}/maybe-later`)
      .set('X-Planet-Id', planet)
      .set('X-Test-Now', now)
      .send({ expectedVersion: version });
  }

  function plantClover(spot: { lat: number; lon: number }, now: string) {
    return command(
      'post',
      'garden/plants',
      { itemType: 'clover', ...spot },
      now,
    );
  }

  /** Every plant straight into bloom, as if it had grown there. */
  function bloomAll(): Promise<unknown> {
    return db.query(
      `UPDATE "plants" SET "stage" = 'bloom', "growth" = 1 WHERE "planet_id" = $1`,
      [planetId],
    );
  }

  /** No creature moves in during the test: the last arrival is "to come". */
  function holdArrivals(): Promise<unknown> {
    return db.query(
      `UPDATE "planets" SET "arrival_tracking" = '{"species": {}, "lastArrivalAt": "2100-01-01T00:00:00.000Z"}' WHERE "id" = $1`,
      [planetId],
    );
  }

  /** Creatures that moved in earlier, one second apart, far from the garden. */
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
        arrivedAt: new Date(Date.parse(T0) + i * 1000),
      })),
    );
  }

  function worm(result: { snapshot: PlanetSnapshotDto }): CreatureDto {
    const [first] = result.snapshot.creatures ?? [];
    expect(first?.species).toBe('worm');
    return first;
  }

  function eventsOf(result: SyncResult | MutationResult, type: string) {
    return result.events.filter((event) => event.type === type);
  }

  function counts(inventory: InventoryItemDto[]): Map<string, number> {
    return new Map(inventory.map((item) => [item.itemType, item.count]));
  }

  /**
   * A first bloom brings the worm during away time; the next sync gives it
   * the scripted tutorial want. Returns that sync's answer.
   */
  async function wormWithWant(): Promise<SyncResult> {
    await plantClover(CLOVER_SPOTS[0], T0);
    const arrival = await sync(at(3 * HOUR));
    // No second model call in the sync that waited for the identity.
    expect(worm(arrival).want).toBeNull();
    ai.reset();
    ai.respondWith(WANT_REPLY);
    const result = await sync(at(3 * HOUR + 10));
    expect(worm(result).want).not.toBeNull();
    return result;
  }

  /** The planet's second clover, bloomed: the scripted want is met. */
  async function meetWant(now: string): Promise<MutationResult> {
    const planted = await plantClover(CLOVER_SPOTS[1], now);
    await bloomAll();
    return planted;
  }

  it('gives the worm its first want at the next sync, one the player can meet with seeds they hold (WNT-01 AC1, ONB-02 AC3)', async () => {
    const result = await wormWithWant();

    const { want } = worm(result);
    expect(want).toEqual({
      id: expect.any(String) as unknown,
      type: 'count-blooming',
      text: WANT_TEXT,
      plainDescription: '2 clovers in bloom',
      spec: { type: 'count-blooming', plant: 'clover', count: 2 },
    });
    // Asked as the tutorial want, with the seeds held now.
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0][1].content).toContain(TUTORIAL_LINE);
    expect(ai.calls[0][1].content).toContain('3 clover');
    const stored = await db.getRepository(Want).findOneByOrFail({
      id: want!.id,
    });
    expect(stored).toMatchObject({ status: 'active', source: 'ai' });
  });

  it('fulfils the want at the next sync after planting: cheerful, a thank-you, a memory and a reward in the inventory (WNT-03, WNT-04 AC1)', async () => {
    const { creatures } = (await wormWithWant()).snapshot;
    const { id: creatureId, name, lat, lon, want } = creatures![0];
    const planted = await meetWant(at(3 * HOUR + 20));
    expect(worm(planted).want).not.toBeNull();

    const result = await sync(at(3 * HOUR + 30));

    const [fulfilled] = eventsOf(result, 'want-fulfilled');
    expect(fulfilled).toEqual({
      type: 'want-fulfilled',
      occurredAt: at(3 * HOUR + 30),
      payload: {
        creatureId,
        name,
        species: 'worm',
        lat,
        lon,
        wantText: WANT_TEXT,
        thankYou: expect.any(String) as unknown,
        reward: expect.any(Array) as unknown,
      },
    });
    const { thankYou, reward } = fulfilled.payload as {
      thankYou: string;
      reward: GrantItem[];
    };
    expect(THANK_YOU_LINES.worm).toContain(thankYou);
    expect(reward.length).toBeGreaterThanOrEqual(1);
    expect(reward.length).toBeLessThanOrEqual(2);

    expect(worm(result)).toMatchObject({ mood: 'cheerful', want: null });
    const before = counts(planted.snapshot.inventory);
    const after = counts(result.snapshot.inventory);
    for (const { itemType, count } of reward) {
      expect(after.get(itemType)).toBe((before.get(itemType) ?? 0) + count);
    }
    // The first reward holds only unlocked items.
    expect(result.newlyUnlocked).toEqual([]);

    expect(
      await db.getRepository(Want).findOneByOrFail({ id: want!.id }),
    ).toMatchObject({
      status: 'fulfilled',
      resolvedAt: new Date(at(3 * HOUR + 30)),
    });
    const memories = await db
      .getRepository(CreatureMemory)
      .findBy({ creatureId });
    expect(memories).toEqual([
      expect.objectContaining({
        kind: 'want',
        text: 'The gardener granted my wish: 2 clovers in bloom',
      }),
    ]);
    const logged = await db
      .getRepository(PlanetEvent)
      .findOneByOrFail({ planetId, type: 'want-fulfilled' });
    expect(logged.payload).toEqual(fulfilled.payload);
  });

  it('celebrates a reward that unlocks something new during a sync (WNT-04 AC2, ITM-04 AC3)', async () => {
    await wormWithWant();
    await meetWant(at(3 * HOUR + 20));
    // Two rewards given before: this one is the third.
    await db.query(
      `UPDATE "planets" SET "reward_counter" = 2 WHERE "id" = $1`,
      [planetId],
    );

    const result = await sync(at(3 * HOUR + 30));

    const [fulfilled] = eventsOf(result, 'want-fulfilled');
    const [unlocked] = (fulfilled.payload as { reward: GrantItem[] }).reward;
    expect(result.newlyUnlocked).toEqual([unlocked.itemType]);
    expect(result.snapshot.unlocks).toContain(unlocked.itemType);
  });

  it('puts a want off with "Maybe later": mood unchanged, the next want only after the cooldown (WNT-05 AC1, AC2)', async () => {
    const { want } = worm(await wormWithWant());
    const later = at(3 * HOUR + 20);

    const res = await maybeLater(want!.id, later).expect(200);

    const result = res.body as MutationResult;
    expect(result.snapshot.version).toBe(version + 1);
    version = result.snapshot.version;
    expect(worm(result)).toMatchObject({ mood: 'content', want: null });
    expect(
      await db.getRepository(Want).findOneByOrFail({ id: want!.id }),
    ).toMatchObject({ status: 'dismissed', resolvedAt: new Date(later) });

    ai.reset();
    expect(worm(await sync(at(3 * HOUR + 20 + 59 * MINUTE))).want).toBeNull();
    const next = worm(await sync(at(4 * HOUR + 20))).want;
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(want!.id);
    // Not the tutorial want any more.
    expect(ai.calls.length).toBeGreaterThan(0);
    for (const call of ai.calls) {
      expect(call[1].content).not.toContain(TUTORIAL_LINE);
    }
  });

  it('refuses "Maybe later" with a friendly 400 for a want that is not waiting', async () => {
    const { want } = worm(await wormWithWant());
    const now = at(3 * HOUR + 20);
    const other = await createPlanet();

    const unknown = await maybeLater(
      '00000000-0000-4000-8000-000000000000',
      now,
    ).expect(400);
    expect(unknown.body).toEqual({
      statusCode: 400,
      message: 'That wish is not waiting any more.',
      reason: 'not-waiting',
    });
    // Another planet's want, sent with that planet's own version.
    const own = version;
    version = other.version;
    await maybeLater(want!.id, now, other.id).expect(400);
    version = own;
    await maybeLater(want!.id, now).expect(200);
    version++;
    // Already put off.
    await maybeLater(want!.id, now).expect(400);
    expect(
      (await db.getRepository(Want).findOneByOrFail({ id: want!.id })).status,
    ).toBe('dismissed');
  });

  it('keeps a want untouched for 30 days active (WNT-05 AC3)', async () => {
    const { want } = worm(await wormWithWant());

    const result = await sync(at(30 * DAY));

    expect(worm(result).want).toEqual(want);
    expect(
      await db.getRepository(Want).countBy({ planetId, status: 'active' }),
    ).toBe(1);
  });

  it('has an overjoyed creature give one gift after a day, then be cheerful (CRT-04 AC2)', async () => {
    const { creatures } = (await wormWithWant()).snapshot;
    const { id: creatureId, name, lat, lon } = creatures![0];
    const since = 3 * HOUR + 10;
    await db.query(
      `UPDATE "creatures" SET "mood" = 'overjoyed', "mood_since" = $2 WHERE "id" = $1`,
      [creatureId, at(since)],
    );

    const early = await sync(at(since + 23 * HOUR));
    expect(eventsOf(early, 'gift-received')).toEqual([]);
    expect(worm(early).mood).toBe('overjoyed');
    const result = await sync(at(since + DAY));

    const gifts = eventsOf(result, 'gift-received');
    expect(gifts).toEqual([
      {
        type: 'gift-received',
        occurredAt: at(since + DAY),
        payload: {
          creatureId,
          name,
          species: 'worm',
          lat,
          lon,
          item: {
            itemType: expect.any(String) as unknown,
            kind: expect.any(String) as unknown,
            count: expect.any(Number) as unknown,
          },
        },
      },
    ]);
    const { item } = gifts[0].payload as { item: GrantItem };
    expect(counts(result.snapshot.inventory).get(item.itemType)).toBe(
      (counts(early.snapshot.inventory).get(item.itemType) ?? 0) + item.count,
    );
    expect(worm(result).mood).toBe('cheerful');
    expect(eventsOf(await sync(at(since + 3 * DAY)), 'gift-received')).toEqual(
      [],
    );
  });

  it('makes the snail wistful when its pond is put away, and its next want asks for the pond back (CRT-04 AC3)', async () => {
    for (const spot of CLOVER_SPOTS) {
      await plantClover(spot, T0);
    }
    const inventory = app.get(InventoryService, { strict: false });
    await db.transaction((em) =>
      inventory.grant(
        em,
        planetId,
        [{ itemType: 'pond', kind: 'decoration', count: 1 }],
        new Date(T0),
      ),
    );
    const placed = await command(
      'post',
      'garden/decorations',
      { itemType: 'pond', ...POND_SPOT },
      T0,
    );
    await bloomAll();
    // It moves in to the finished garden, so its first want comes now.
    await holdArrivals();
    await moveIn('snail');
    const happy = (await sync(at(10))).snapshot.creatures![0];
    expect(happy).toMatchObject({ species: 'snail', wistful: false });
    expect(happy.want).not.toBeNull();

    const removed = await command(
      'delete',
      `garden/decorations/${placed.snapshot.decorations[0].id}`,
      {},
      at(20),
    );
    expect(removed.snapshot.creatures![0].wistful).toBe(true);
    await maybeLater(happy.want!.id, at(20)).expect(200);
    version++;

    const next = (await sync(at(20 + HOUR))).snapshot.creatures![0];
    expect(next).toMatchObject({ wistful: true, mood: 'content' });
    expect(next.want).toMatchObject({
      type: 'bring-back',
      plainDescription: 'Bring back the pond',
      spec: { type: 'bring-back', itemKind: 'decoration', item: 'pond' },
    });
  });

  it('gives at most one creature a new want per sync (AI latency)', async () => {
    await moveIn('worm', 'bee');

    await sync(at(10));
    const wantsAfterOne = await db.getRepository(Want).find({
      where: { planetId },
    });
    expect(wantsAfterOne).toHaveLength(1);
    const usage = await db.query<unknown[]>(
      `SELECT 1 FROM "ai_usage" WHERE "planet_id" = $1 AND "feature" = 'want'`,
      [planetId],
    );
    expect(usage).toHaveLength(1);
    const result = await sync(at(20));

    expect(result.snapshot.creatures?.map((each) => !!each.want)).toEqual([
      true,
      true,
    ]);
  });

  it('says "1 wish came true" on return after a want was met while away (TIM-03, WNT-03 AC1)', async () => {
    const { creatures } = (await wormWithWant()).snapshot;
    // The second clover blooms in 5 minutes, during the away time.
    await plantClover(CLOVER_SPOTS[1], at(3 * HOUR + 20));

    const result = await sync(at(6 * HOUR));

    expect(eventsOf(result, 'want-fulfilled')).toHaveLength(1);
    expect(result.welcomeBack?.summary).toContainEqual({
      kind: 'wants',
      count: 1,
      text: '1 wish came true',
      focus: { lat: creatures![0].lat, lon: creatures![0].lon },
    });
  });
});
