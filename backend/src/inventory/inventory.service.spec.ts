import { BadRequestException, HttpException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { InventoryService } from './inventory.service';

const PLANET_ID = 'planet-1';
const OTHER_PLANET_ID = 'planet-2';
const T0 = new Date('2030-01-01T00:00:00.000Z');
const T1 = new Date('2030-01-01T00:05:00.000Z');

type Row = Record<string, unknown>;

interface EntityClass {
  name: string;
}

/**
 * The slice of EntityManager the service uses, over in-memory tables keyed by
 * entity name. Criteria are plain equality, which is all the service passes;
 * ordering is the database's job, covered by test/garden.e2e-spec.ts.
 */
class FakeEntityManager {
  readonly tables: Record<string, Row[]> = { InventoryItem: [], Unlock: [] };
  private nextId = 1;

  findOneBy(entity: EntityClass, where: Row): Promise<Row | null> {
    const row = this.matching(entity, where)[0];
    return Promise.resolve(row ? { ...row } : null);
  }

  find(entity: EntityClass, options: { where: Row }): Promise<Row[]> {
    return Promise.resolve(
      this.matching(entity, options.where).map((row) => ({ ...row })),
    );
  }

  existsBy(entity: EntityClass, where: Row): Promise<boolean> {
    return Promise.resolve(this.matching(entity, where).length > 0);
  }

  insert(entity: EntityClass, values: Row): Promise<void> {
    // Unlocks are keyed by planet and type; only stacks get a generated id.
    const id =
      entity.name === 'InventoryItem' ? { id: `item-${this.nextId++}` } : {};
    this.tables[entity.name].push({ ...id, ...values });
    return Promise.resolve();
  }

  update(entity: EntityClass, where: Row, patch: Row): Promise<void> {
    for (const row of this.matching(entity, where)) {
      Object.assign(row, patch);
    }
    return Promise.resolve();
  }

  delete(entity: EntityClass, where: Row): Promise<void> {
    const gone = new Set(this.matching(entity, where));
    this.tables[entity.name] = this.tables[entity.name].filter(
      (row) => !gone.has(row),
    );
    return Promise.resolve();
  }

  /** The planet's stacks as type to count. */
  counts(planetId = PLANET_ID): Record<string, unknown> {
    const stacks = this.tables.InventoryItem.filter(
      (row) => row.planetId === planetId,
    );
    return Object.fromEntries(
      stacks.map((row): [string, unknown] => [String(row.itemType), row.count]),
    );
  }

  private matching(entity: EntityClass, where: Row): Row[] {
    return this.tables[entity.name].filter((row) =>
      Object.entries(where).every(([key, value]) => row[key] === value),
    );
  }
}

function setup() {
  const fake = new FakeEntityManager();
  return {
    fake,
    em: fake as unknown as EntityManager,
    inventory: new InventoryService(),
  };
}

async function rejection(run: Promise<unknown>): Promise<HttpException> {
  try {
    await run;
  } catch (thrown) {
    return thrown as HttpException;
  }
  throw new Error('expected a rejection');
}

describe('InventoryService', () => {
  describe('grant', () => {
    it('creates stacks and adds to existing ones', async () => {
      const { fake, em, inventory } = setup();

      await inventory.grant(
        em,
        PLANET_ID,
        [{ itemType: 'clover', kind: 'seed', count: 4 }],
        T0,
      );
      await inventory.grant(
        em,
        PLANET_ID,
        [
          { itemType: 'clover', kind: 'seed', count: 2 },
          { itemType: 'pond', kind: 'decoration', count: 1 },
        ],
        T1,
      );

      expect(fake.counts()).toEqual({ clover: 6, pond: 1 });
      expect(fake.tables.InventoryItem).toContainEqual(
        expect.objectContaining({ itemType: 'pond', kind: 'decoration' }),
      );
    });

    it('unlocks a never-owned type and reports it exactly once (ITM-04 AC3)', async () => {
      const { fake, em, inventory } = setup();
      const clover = { itemType: 'clover', kind: 'seed', count: 1 } as const;

      const first = await inventory.grant(em, PLANET_ID, [clover, clover], T0);
      const second = await inventory.grant(em, PLANET_ID, [clover], T1);

      expect(first.newlyUnlocked).toEqual(['clover']);
      expect(second.newlyUnlocked).toEqual([]);
      expect(fake.tables.Unlock).toEqual([
        { planetId: PLANET_ID, itemType: 'clover', unlockedAt: T0 },
      ]);
    });

    it('still reports nothing new for an unlocked type whose stack ran out', async () => {
      const { em, inventory } = setup();
      const tulip = { itemType: 'tulip', kind: 'seed', count: 1 } as const;
      await inventory.grant(em, PLANET_ID, [tulip], T0);
      await inventory.consume(em, PLANET_ID, 'tulip');

      const again = await inventory.grant(em, PLANET_ID, [tulip], T1);

      expect(again.newlyUnlocked).toEqual([]);
    });

    it("keeps each planet's stacks and unlocks apart", async () => {
      const { fake, em, inventory } = setup();
      const fern = { itemType: 'fern', kind: 'seed', count: 1 } as const;
      await inventory.grant(em, PLANET_ID, [fern], T0);

      const other = await inventory.grant(em, OTHER_PLANET_ID, [fern], T0);

      expect(other.newlyUnlocked).toEqual(['fern']);
      expect(fake.counts(PLANET_ID)).toEqual({ fern: 1 });
      expect(fake.counts(OTHER_PLANET_ID)).toEqual({ fern: 1 });
    });
  });

  describe('consume', () => {
    it('takes one by default', async () => {
      const { fake, em, inventory } = setup();
      await inventory.grant(
        em,
        PLANET_ID,
        [{ itemType: 'clover', kind: 'seed', count: 4 }],
        T0,
      );

      await inventory.consume(em, PLANET_ID, 'clover');

      expect(fake.counts()).toEqual({ clover: 3 });
    });

    it('removes a stack that runs out (ITM-01 AC2)', async () => {
      const { fake, em, inventory } = setup();
      await inventory.grant(
        em,
        PLANET_ID,
        [{ itemType: 'clover', kind: 'seed', count: 2 }],
        T0,
      );

      await inventory.consume(em, PLANET_ID, 'clover', 2);

      expect(fake.tables.InventoryItem).toEqual([]);
    });

    it.each([
      ['more than the planet holds', 3],
      ['a type it has none of', 0],
    ])('refuses %s with a not-owned 400', async (_label, owned) => {
      const { fake, em, inventory } = setup();
      if (owned > 0) {
        await inventory.grant(
          em,
          PLANET_ID,
          [{ itemType: 'clover', kind: 'seed', count: owned }],
          T0,
        );
      }

      const error = await rejection(
        inventory.consume(em, PLANET_ID, 'clover', 4),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual({
        statusCode: 400,
        message: "You don't have any of those right now.",
        reason: 'not-owned',
      });
      expect(fake.counts()).toEqual(owned > 0 ? { clover: owned } : {});
    });

    it("does not touch another planet's stack", async () => {
      const { fake, em, inventory } = setup();
      await inventory.grant(
        em,
        OTHER_PLANET_ID,
        [{ itemType: 'clover', kind: 'seed', count: 1 }],
        T0,
      );

      await expect(
        inventory.consume(em, PLANET_ID, 'clover'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fake.counts(OTHER_PLANET_ID)).toEqual({ clover: 1 });
    });
  });

  describe('list', () => {
    it("returns only the planet's own stacks", async () => {
      const { em, inventory } = setup();
      await inventory.grant(
        em,
        PLANET_ID,
        [{ itemType: 'clover', kind: 'seed', count: 2 }],
        T0,
      );
      await inventory.grant(
        em,
        OTHER_PLANET_ID,
        [{ itemType: 'fern', kind: 'seed', count: 1 }],
        T0,
      );

      const items = await inventory.list(em, PLANET_ID);

      expect(items).toEqual([
        expect.objectContaining({ itemType: 'clover', count: 2 }),
      ]);
    });
  });
});
