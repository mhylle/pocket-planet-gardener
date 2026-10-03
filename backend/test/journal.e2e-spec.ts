import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { wordCount } from '../src/ai/content-rules';
import { findPrivateData } from '../src/ai/prompt-context';
import type { CreatureIdentity } from '../src/creatures/identity.types';
import type {
  JournalEntryDto,
  JournalPageDto,
} from '../src/journal/dto/journal-entry.dto';
import { JournalEntry } from '../src/journal/journal-entry.entity';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// A Tuesday, on the 15-minute grid: a sunflower planted then blooms at 02:00
// under away-time light (test/growth.e2e-spec.ts), and the first bloom brings
// the worm at the sync that finds it (test/creatures.e2e-spec.ts).
const T0 = '2030-01-01T00:00:00.000Z';
const HOUR = 3600;
const DAY = 24 * HOUR;
const SPOT = { lat: 10, lon: 20 };
const OTHER_SPOT = { lat: -30, lon: 100 };

/** The instant some seconds after T0, as X-Test-Now wants it. */
function at(seconds: number): string {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString();
}

/** The worm's identity, as the model would answer it. */
const WORM: CreatureIdentity = {
  name: 'Wigglenut',
  traits: ['bubbly', 'curious'],
  quirk: 'Believes that every pebble is actually a sleeping mountain.',
  speakingStyle: 'bubbly and breathless',
  backstory:
    'Wigglenut tunnelled up to see the first flower. It liked the view and stayed.',
  summary: 'A bubbly worm who thinks pebbles are mountains.',
};

const ENTRY_TEXT =
  'What a Tuesday! The sunflower bloomed at last, and Wigglenut the worm moved in right beside it. ' +
  'Wigglenut thinks the pebbles are sleeping mountains and tiptoed past them all afternoon.';
const ZORBLAX_TEXT =
  'The sunflower bloomed, and Zorblax the snail threw a party for Wigglenut the worm, who had just moved in.';
const QUIET_TEXT =
  'A quiet Tuesday on Moonbeam. The clouds drifted past like sleepy sheep, and the sun took its time crossing the sky. ' +
  'Nothing needed doing, so nobody did it.';

const FIRST_BLOOM = {
  type: 'plant-bloomed',
  label: 'First bloom: sunflower',
  occurredAt: '2030-01-01T02:00:00.000Z',
};

// Uses the dev database and empties the planets table and its children.
describe('Planet journal (e2e)', () => {
  const ai = new FakeAiService();
  let app: INestApplication<App>;
  let db: DataSource;
  let planet: PlanetSnapshotDto;
  let version: number;

  beforeAll(async () => {
    app = await bootWithFakeAi(ai);
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    ai.reset();
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    // Drops the settings cache too, which may still hold an earlier test's
    // switch read at the same test instant.
    await request(app.getHttpServer())
      .patch('/api/admin/settings')
      .send({ aiEnabled: true })
      .expect(200);
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', T0)
      .send({ name: 'Moonbeam' })
      .expect(201);
    planet = created.body as PlanetSnapshotDto;
    version = planet.version;
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    await app.close();
  });

  async function plant(
    spot: { lat: number; lon: number },
    now = T0,
    itemType = 'sunflower',
  ): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/api/garden/plants')
      .set('X-Planet-Id', planet.id)
      .set('X-Test-Now', now)
      .send({ itemType, ...spot, expectedVersion: version })
      .expect(201);
    version = (res.body as { snapshot: PlanetSnapshotDto }).snapshot.version;
  }

  async function sync(now: string): Promise<SyncResult> {
    const res = await request(app.getHttpServer())
      .post('/api/planet/sync')
      .set('X-Planet-Id', planet.id)
      .set('X-Test-Now', now)
      .send({ expectedVersion: version })
      .expect(200);
    return res.body as SyncResult;
  }

  function journal(query: Record<string, string> = {}, planetId = planet.id) {
    return request(app.getHttpServer())
      .get('/api/journal')
      .query(query)
      .set('X-Planet-Id', planetId);
  }

  async function page(
    query: Record<string, string> = {},
  ): Promise<JournalPageDto> {
    return (await journal(query).expect(200)).body as JournalPageDto;
  }

  function storedEntries(): Promise<JournalEntry[]> {
    return db.getRepository(JournalEntry).find({
      where: { planetId: planet.id },
      order: { createdAt: 'ASC' },
    });
  }

  function journalUsage(): Promise<
    { used_fallback: boolean; reason: string | null }[]
  > {
    return db.query(
      `SELECT "used_fallback", "reason" FROM "ai_usage" WHERE "planet_id" = $1 AND "feature" = 'journal'`,
      [planet.id],
    );
  }

  describe('writing an entry on return (Task 14.3)', () => {
    it('opens a dated AI entry after 5 hours away with a bloom, beside the summary (JRN-01 AC1, AC2)', async () => {
      await plant(SPOT);
      ai.respondWith(JSON.stringify(WORM), ENTRY_TEXT);

      const result = await sync(at(5 * HOUR));

      expect(result.welcomeBack?.summary.map((line) => line.kind)).toEqual([
        'blooms',
        'creatures',
      ]);
      expect(result.welcomeBack?.journalEntry).toEqual({
        id: expect.any(String) as unknown,
        text: ENTRY_TEXT,
        source: 'ai',
        createdAt: at(5 * HOUR),
        // A first entry looks back at most GAME_MAX_AWAY_DAYS.
        coversFrom: at(5 * HOUR - 7 * DAY),
        coversTo: at(5 * HOUR),
        milestones: [
          FIRST_BLOOM,
          {
            type: 'creature-arrived',
            label: 'Wigglenut the worm moved in',
            occurredAt: at(5 * HOUR),
          },
        ],
      } satisfies Record<keyof JournalEntryDto, unknown>);
      expect(await storedEntries()).toMatchObject([
        { text: ENTRY_TEXT, source: 'ai' },
      ]);
      expect(await journalUsage()).toEqual([
        { used_fallback: false, reason: null },
      ]);
    });

    it('asks with the date, the creatures by name and the news, and nothing private (JRN-01 AC2, AIB-02)', async () => {
      await plant(SPOT);
      ai.respondWith(JSON.stringify(WORM), ENTRY_TEXT);

      await sync(at(5 * HOUR));

      expect(ai.calls).toHaveLength(2);
      const [system, user] = ai.calls[1];
      expect(system.content).toContain('at most 150 words');
      expect(user.content).toContain('Today is Tuesday 1 January.');
      expect(user.content).toContain(
        '- Wigglenut the worm: A bubbly worm who thinks pebbles are mountains.',
      );
      expect(user.content).toContain(
        'News since the last diary page, oldest first:\n- sunflower bloomed\n- Wigglenut the worm moved in',
      );
      expect(
        findPrivateData(JSON.stringify(ai.calls[1]), [planet.id, planet.code]),
      ).toEqual([]);
    });

    it('writes no second entry on an immediate re-sync, nor within 4 hours of the last one (JRN-01 AC4)', async () => {
      await plant(SPOT);
      ai.respondWith(JSON.stringify(WORM), ENTRY_TEXT);
      await sync(at(5 * HOUR));

      expect(await sync(at(5 * HOUR + 10))).not.toHaveProperty('welcomeBack');
      expect(await sync(at(7 * HOUR))).not.toHaveProperty('welcomeBack');
      // Even when the last visit looks long ago, the entry is too recent.
      await db.query(
        `UPDATE "planets" SET "last_seen_at" = $2 WHERE "id" = $1`,
        [planet.id, at(3 * HOUR)],
      );
      const result = await sync(at(8 * HOUR));

      expect(result.welcomeBack?.journalEntry).toBeUndefined();
      expect(await storedEntries()).toHaveLength(1);
      expect(await journalUsage()).toHaveLength(1);
    });

    it('writes no entry after only 3 hours away; the summary still comes', async () => {
      await plant(SPOT);

      const result = await sync(at(3 * HOUR));

      expect(result.welcomeBack?.summary).toHaveLength(2);
      expect(result.welcomeBack).not.toHaveProperty('journalEntry');
      expect(await storedEntries()).toEqual([]);
      expect(await journalUsage()).toEqual([]);
    });

    it('uses the template when the model twice names a creature the planet does not have (JRN-02 AC2)', async () => {
      await plant(SPOT);
      ai.respondWith(JSON.stringify(WORM), ZORBLAX_TEXT, ZORBLAX_TEXT);

      const entry = (await sync(at(5 * HOUR))).welcomeBack?.journalEntry;

      expect(entry?.source).toBe('template');
      expect(entry?.text).not.toContain('Zorblax');
      expect(entry?.text).toContain('Wigglenut');
      expect(entry?.text).toContain('sunflower bloomed');
      expect(ai.calls).toHaveLength(3);
      // The retry names the problem.
      expect(ai.calls[2].at(-1)?.content).toContain(
        'it named a creature that does not live on the planet',
      );
      expect(await journalUsage()).toEqual([
        { used_fallback: true, reason: 'invalid' },
      ]);
      expect(await storedEntries()).toMatchObject([{ source: 'template' }]);
    });

    it('writes the template from the event log when the AI is switched off (JRN-02 AC4)', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .send({ aiEnabled: false })
        .expect(200);
      await plant(SPOT);

      const result = await sync(at(5 * HOUR));

      const [worm] = result.snapshot.creatures ?? [];
      const entry = result.welcomeBack?.journalEntry;
      expect(entry?.source).toBe('template');
      expect(entry?.text).toContain(`${worm.name} the worm`);
      expect(entry?.text).toContain('sunflower bloomed');
      expect(wordCount(entry!.text)).toBeLessThanOrEqual(150);
      expect(entry?.milestones.map((milestone) => milestone.label)).toEqual([
        FIRST_BLOOM.label,
        `${worm.name} the worm moved in`,
      ]);
      expect(ai.calls).toHaveLength(0);
      expect(await journalUsage()).toEqual([
        { used_fallback: true, reason: 'disabled' },
      ]);
    });

    it('still writes a cosy entry after a quiet 5 hours, with an empty summary (JRN-02 AC3)', async () => {
      ai.respondWith(QUIET_TEXT);

      const result = await sync(at(5 * HOUR));

      expect(result.events).toEqual([]);
      expect(result.welcomeBack).toEqual({
        summary: [],
        journalEntry: expect.objectContaining({
          text: QUIET_TEXT,
          source: 'ai',
          milestones: [],
        }) as unknown,
      });
      expect(ai.calls[0][1].content).toContain(
        'News since the last diary page: none, it was a quiet time.',
      );
    });

    it('falls back to a quiet template that invents nothing when the model is down (JRN-02 AC3, AC4)', async () => {
      ai.failure = new Error('model down');

      const result = await sync(at(5 * HOUR));

      const entry = result.welcomeBack?.journalEntry;
      expect(result.welcomeBack?.summary).toEqual([]);
      expect(entry?.source).toBe('template');
      expect(entry?.text).toMatch(/Moonbeam|Tuesday/);
      expect(entry?.text).not.toMatch(/bloomed|moved in|gift|wish/);
    });
  });

  describe('the journal book (JRN-03)', () => {
    /** Three entries, 5 hours apart: the first bloom and the worm, a second bloom, a quiet one. */
    async function threeEntries(): Promise<void> {
      ai.failure = new Error('model down');
      await plant(SPOT);
      await sync(at(5 * HOUR));
      await plant(OTHER_SPOT, at(5 * HOUR), 'clover');
      await sync(at(10 * HOUR));
      await sync(at(15 * HOUR));
    }

    it('pages through every entry, newest first (AC1)', async () => {
      await threeEntries();

      const first = await page({ limit: '2' });
      expect(first.entries.map((entry) => entry.createdAt)).toEqual([
        at(15 * HOUR),
        at(10 * HOUR),
      ]);
      expect(first.hasMore).toBe(true);

      const rest = await page({
        limit: '2',
        before: first.entries[1].createdAt,
      });
      expect(rest.entries.map((entry) => entry.createdAt)).toEqual([
        at(5 * HOUR),
      ]);
      expect(rest.hasMore).toBe(false);

      const all = await page();
      expect(all.entries).toHaveLength(3);
      expect(all.hasMore).toBe(false);
      // Each entry starts where the one before it stopped.
      expect(all.entries[1].coversFrom).toBe(all.entries[2].coversTo);
      expect(all.entries[0].coversFrom).toBe(all.entries[1].coversTo);
    });

    it('marks the first bloom and the creature arrival on the entry that covers them (AC2)', async () => {
      await threeEntries();
      const [worm] = (
        (
          await request(app.getHttpServer())
            .get('/api/planet')
            .set('X-Planet-Id', planet.id)
            .expect(200)
        ).body as PlanetSnapshotDto
      ).creatures!;

      const { entries } = await page();

      expect(entries.map((entry) => entry.milestones)).toEqual([
        [],
        // The clover's bloom is not the first one.
        [],
        [
          FIRST_BLOOM,
          {
            type: 'creature-arrived',
            label: `${worm.name} the worm moved in`,
            occurredAt: at(5 * HOUR),
          },
        ],
      ]);
    });

    it('shows a planet only its own entries, and an empty book before the first one', async () => {
      await threeEntries();
      const other = await request(app.getHttpServer())
        .post('/api/planet')
        .set('X-Test-Now', T0)
        .send({ name: 'Pebble' })
        .expect(201);

      const res = await journal(
        {},
        (other.body as PlanetSnapshotDto).id,
      ).expect(200);

      expect(res.body).toEqual({ entries: [], hasMore: false });
    });

    it('refuses a bad page request with a 400, and needs a planet', async () => {
      await journal({ limit: '0' }).expect(400);
      await journal({ limit: '21' }).expect(400);
      await journal({ before: 'yesterday' }).expect(400);
      await request(app.getHttpServer()).get('/api/journal').expect(400);
    });

    it('removes the entries with the planet (ACC-05)', async () => {
      await threeEntries();

      await request(app.getHttpServer())
        .delete('/api/planet')
        .set('X-Planet-Id', planet.id)
        .send({ confirm: 'DELETE' })
        .expect(204);

      expect(await db.getRepository(JournalEntry).count()).toBe(0);
    });
  });
});
