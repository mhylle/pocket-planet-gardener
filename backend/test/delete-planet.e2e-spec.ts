import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, type EntityMetadata } from 'typeorm';
import type { CreatureIdentity } from '../src/creatures/identity.types';
import { InventoryService } from '../src/inventory/inventory.service';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { SyncResult } from '../src/planets/planet-state/planet-state.service';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// A sunflower planted at T0 blooms at 02:00 under away-time light, and the
// first bloom brings the worm at the sync that finds it; 5 hours away also
// write a journal entry (test/journal.e2e-spec.ts).
const T0 = '2030-01-01T00:00:00.000Z';
const HOUR = 3600;
const SPOT = { lat: 10, lon: 20 };
const POND_SPOT = { lat: -30, lon: 100 };

/** The instant some seconds after T0, as X-Test-Now wants it. */
function at(seconds: number): string {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString();
}

/**
 * Tables no planet owns, each with the reason. Every other table must lead
 * to planets through its foreign keys, so a new table has to pick a side.
 */
const GLOBAL_TABLES: Record<string, string> = {
  // The game owner's AI switch and budget (ADM-01, ADM-02).
  admin_settings: 'game-wide settings',
  // TypeORM's own record of the migrations run; it has no entity.
  migrations: 'schema bookkeeping',
};

/**
 * Planet-owned tables whose rows outlive the planet, cut loose from it
 * (ON DELETE SET NULL) rather than deleted, each with the reason.
 */
const KEPT_UNLINKED: Record<string, string> = {
  // The game-wide daily AI budget counts today's calls (ADM-02, NFR-10).
  // A row holds the feature, fallback, reason and latency: no player data.
  ai_usage: 'daily AI budget',
};

const IDENTITIES: Record<'A' | 'B', CreatureIdentity> = {
  A: {
    name: 'Wigglenut',
    traits: ['bubbly', 'curious'],
    quirk: 'Believes that every pebble is actually a sleeping mountain.',
    speakingStyle: 'bubbly and breathless',
    backstory:
      'Wigglenut tunnelled up to see the first flower. It liked the view and stayed.',
    summary: 'A bubbly worm who thinks pebbles are mountains.',
  },
  B: {
    name: 'Squigglet',
    traits: ['sleepy', 'kind'],
    quirk:
      'Counts the clouds every morning and always gets a different answer.',
    speakingStyle: 'slow and yawning',
    backstory:
      'Squigglet woke up under the first flower and decided it was a good place to nap.',
    summary: 'A sleepy worm who keeps losing count of the clouds.',
  },
};

const WANT = JSON.stringify({
  spec: { type: 'count-blooming', plant: 'clover', count: 2 },
  text: 'Two clovers in bloom would make my tunnel smell lovely. Could you?',
});
const REPLY = 'Ooh, hello! The pebbles are snoring softly today. Shall we dig?';
const HIGHLIGHT = 'The gardener loves sunflowers.';

/** Rows of one table that lead to a planet, and a digest of their contents. */
interface TableCensus {
  rows: number;
  digest: string;
}

/**
 * SQL true for a row of the table, under alias, that leads to the planet
 * given as $1 through any chain of foreign keys; null when no chain exists.
 * Tables already on the chain are not entered again.
 */
function reachesPlanet(
  meta: EntityMetadata,
  alias: string,
  chain: readonly string[],
): string | null {
  if (meta.tableName === 'planets') {
    return `${alias}."${meta.primaryColumns[0].databaseName}" = $1`;
  }
  const paths = meta.foreignKeys.flatMap((fk) => {
    const target = fk.referencedEntityMetadata;
    if (chain.includes(target.tableName)) {
      return [];
    }
    const inner = `t${chain.length}`;
    const condition = reachesPlanet(target, inner, [
      ...chain,
      target.tableName,
    ]);
    if (!condition) {
      return [];
    }
    const columns = fk.columnNames.map((c) => `${alias}."${c}"`).join(', ');
    const referenced = fk.referencedColumnNames
      .map((c) => `${inner}."${c}"`)
      .join(', ');
    return [
      `(${columns}) IN (SELECT ${referenced} FROM "${target.tableName}" ${inner} WHERE ${condition})`,
    ];
  });
  return paths.length > 0
    ? paths.map((path) => `(${path})`).join(' OR ')
    : null;
}

// Uses the dev database and empties the planets table and its children.
describe('Delete planet completeness (e2e, ACC-05, NFR-06)', () => {
  const ai = new FakeAiService();
  let app: INestApplication<App>;
  let db: DataSource;
  // Every planet-owned table, with the condition that finds a planet's rows.
  let owned: Map<string, string>;

  beforeAll(async () => {
    app = await bootWithFakeAi(ai);
    db = app.get(DataSource);
    owned = new Map();
    for (const meta of db.entityMetadatas) {
      const condition = reachesPlanet(meta, 'r', [meta.tableName]);
      if (condition) {
        owned.set(meta.tableName, condition);
      }
    }
  });

  beforeEach(async () => {
    ai.reset();
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    await app.close();
  });

  /** A planet the way a player gets there, keeping its version for the next command. */
  class Player {
    version = 1;

    constructor(readonly id: string) {}

    async command(path: string, body: object, now: string): Promise<void> {
      const res = await request(app.getHttpServer())
        .post(`/api/garden/${path}`)
        .set('X-Planet-Id', this.id)
        .set('X-Test-Now', now)
        .send({ ...body, expectedVersion: this.version })
        .expect(201);
      this.version = (
        res.body as { snapshot: PlanetSnapshotDto }
      ).snapshot.version;
    }

    async sync(now: string): Promise<SyncResult> {
      const res = await request(app.getHttpServer())
        .post('/api/planet/sync')
        .set('X-Planet-Id', this.id)
        .set('X-Test-Now', now)
        .send({ expectedVersion: this.version })
        .expect(200);
      const result = res.body as SyncResult;
      this.version = result.snapshot.version;
      return result;
    }

    async chat(creatureId: string, text: string, now: string): Promise<void> {
      await request(app.getHttpServer())
        .post(`/api/creatures/${creatureId}/chat`)
        .set('X-Planet-Id', this.id)
        .set('X-Test-Now', now)
        .send({ text })
        .expect(201);
    }
  }

  /**
   * A planet with a row in every planet-owned table, made through the real
   * routes: create (inventory, unlocks), plant, a sync after 5 hours away
   * (growth events, the worm with its identity, a journal entry), a sync for
   * the worm's first want, five chat messages (the fifth keeps a memory
   * highlight) and a pond. Only granting the pond has no route. Every model
   * call logs an ai_usage row.
   */
  async function populatedPlanet(name: string, key: 'A' | 'B') {
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', T0)
      .send({ name })
      .expect(201);
    const player = new Player((created.body as PlanetSnapshotDto).id);

    await player.command('plants', { itemType: 'sunflower', ...SPOT }, T0);
    ai.respondWith(
      JSON.stringify(IDENTITIES[key]),
      `${name} had a lovely day.`,
    );
    const arrived = await player.sync(at(5 * HOUR));
    const worm = arrived.snapshot.creatures?.[0];
    expect(worm?.species).toBe('worm');

    ai.respondWith(WANT);
    await player.sync(at(5 * HOUR + 30));

    for (let i = 1; i <= 5; i++) {
      ai.respondWith(REPLY, ...(i === 5 ? [HIGHLIGHT] : []));
      await player.chat(worm!.id, `Hello number ${i}!`, at(5 * HOUR + 60 + i));
    }

    const now = at(5 * HOUR + 120);
    await db.transaction((em) =>
      app
        .get(InventoryService, { strict: false })
        .grant(
          em,
          player.id,
          [{ itemType: 'pond', kind: 'decoration', count: 1 }],
          new Date(now),
        ),
    );
    await player.command(
      'decorations',
      { itemType: 'pond', ...POND_SPOT },
      now,
    );
    return player;
  }

  /** Per planet-owned table: the rows that lead to the planet and their digest. */
  async function census(planetId: string): Promise<Map<string, TableCensus>> {
    const result = new Map<string, TableCensus>();
    for (const [table, condition] of owned) {
      const [row] = await db.query<TableCensus[]>(
        `SELECT count(*)::int AS "rows", md5(coalesce(string_agg(r::text, '|' ORDER BY r::text), '')) AS "digest" FROM "${table}" r WHERE ${condition}`,
        [planetId],
      );
      result.set(table, row);
    }
    return result;
  }

  /** Every row of every planet-owned table, planet or not. */
  async function totals(): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const table of owned.keys()) {
      const [{ rows }] = await db.query<{ rows: number }[]>(
        `SELECT count(*)::int AS "rows" FROM "${table}"`,
      );
      result.set(table, rows);
    }
    return result;
  }

  it('sorts every table as planet-owned or global, and every entity table exists', async () => {
    const tables = (
      await db.query<{ name: string }[]>(
        `SELECT table_name AS "name" FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      )
    )
      .map(({ name }) => name)
      .sort();
    const entityTables = db.entityMetadatas.map((meta) => meta.tableName);

    // A table only a migration knows has no metadata to walk: it must be listed.
    expect(tables).toEqual(
      [...new Set([...entityTables, ...Object.keys(GLOBAL_TABLES)])].sort(),
    );
    for (const table of tables) {
      expect([table, owned.has(table) || table in GLOBAL_TABLES]).toEqual([
        table,
        true,
      ]);
      expect([table, owned.has(table) && table in GLOBAL_TABLES]).toEqual([
        table,
        false,
      ]);
    }
    for (const table of Object.keys(KEPT_UNLINKED)) {
      expect([table, owned.has(table)]).toEqual([table, true]);
    }
    // The walk found the planet itself and its children's children.
    expect(owned.has('planets')).toBe(true);
    expect(owned.has('creature_memories')).toBe(true);
  });

  it('deletes every row that leads to the planet, and leaves the other planet as it was (ACC-05 AC1)', async () => {
    const a = await populatedPlanet('Moonbeam', 'A');
    const b = await populatedPlanet('Sunpatch', 'B');
    // A global row too, which no planet delete may touch.
    await request(app.getHttpServer())
      .patch('/api/admin/settings')
      .send({ aiEnabled: true })
      .expect(200);

    const beforeA = await census(a.id);
    const beforeB = await census(b.id);
    const totalsBefore = await totals();
    const [{ settings }] = await db.query<{ settings: number }[]>(
      'SELECT count(*)::int AS "settings" FROM "admin_settings"',
    );
    // Every planet-owned table holds rows of both planets, so the delete is
    // tested against all of them; a new table without data fails here.
    for (const table of owned.keys()) {
      expect([table, beforeA.get(table)!.rows > 0]).toEqual([table, true]);
      expect([table, beforeB.get(table)!.rows > 0]).toEqual([table, true]);
    }

    await request(app.getHttpServer())
      .delete('/api/planet')
      .set('X-Planet-Id', a.id)
      .send({ confirm: 'DELETE' })
      .expect(204);

    const afterA = await census(a.id);
    const afterB = await census(b.id);
    const totalsAfter = await totals();
    for (const table of owned.keys()) {
      expect([table, afterA.get(table)!.rows]).toEqual([table, 0]);
      expect([table, afterB.get(table)]).toEqual([table, beforeB.get(table)]);
      // Gone, not just cut loose; except where a row is kept on purpose.
      const removed = table in KEPT_UNLINKED ? 0 : beforeA.get(table)!.rows;
      expect([table, totalsAfter.get(table)]).toEqual([
        table,
        totalsBefore.get(table)! - removed,
      ]);
    }
    expect(
      await db.query<{ settings: number }[]>(
        'SELECT count(*)::int AS "settings" FROM "admin_settings"',
      ),
    ).toEqual([{ settings }]);
    await request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', a.id)
      .expect(404);
  });
});
