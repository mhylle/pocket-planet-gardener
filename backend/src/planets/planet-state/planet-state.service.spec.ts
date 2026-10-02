import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { FakeClock } from '../../../test/support/fake-clock';
import type { Planet } from '../planet.entity';
import type { Fact, MutationContext } from './mutation.types';
import { PlanetStateService } from './planet-state.service';

const PLANET_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';
const OTHER_PLANET_ID = '00000000-0000-4000-8000-000000000000';
const T0 = new Date('2030-01-01T00:00:00.000Z');
const T1 = new Date('2030-01-01T00:05:00.000Z');

function planetRow(): Planet {
  return {
    id: PLANET_ID,
    code: 'MOON2345',
    name: 'Moonbeam',
    radiusLevel: 1,
    maxPlants: 60,
    version: 3,
    lastSimulatedAt: T0,
    lastSeenAt: T0,
    sunOverrideAngle: null,
    sunOverrideAt: null,
    tutorialStep: 0,
    clouds: [],
    arrivalTracking: {},
    rewardCounter: 0,
    createdAt: T0,
  };
}

function plantRow(id: string, planetId = PLANET_ID) {
  return {
    id,
    planetId,
    type: 'clover',
    lat: 1,
    lon: 2,
    stage: 'seed',
    growth: 0,
    water: 0.5,
    plantedAt: T0,
    lastHarvestedAt: null,
    harvestReady: false,
  };
}

interface Row {
  id?: string;
  planetId?: string;
}

interface EntityClass {
  name: string;
}

/**
 * The slice of EntityManager the service uses, over in-memory tables keyed by
 * entity name and shared with the other fake manager of a test. It hands out
 * copies, like the database, but filters by planet only: ordering and the
 * inventory count filter are the database's job, covered by
 * test/planet-state.e2e-spec.ts. Every call goes to the shared log, prefixed
 * with the manager's label.
 */
class FakeEntityManager {
  constructor(
    private readonly label: string,
    private readonly tables: Record<string, Row[]>,
    private readonly log: string[],
  ) {}

  findOneBy(entity: EntityClass, where: { id: string }): Promise<Row | null> {
    this.log.push(`${this.label} findOneBy ${entity.name}`);
    return Promise.resolve(this.byId(entity, where.id));
  }

  findOne(
    entity: EntityClass,
    options: { where: { id: string }; lock?: { mode: string } },
  ): Promise<Row | null> {
    const lock = options.lock?.mode ?? 'unlocked';
    this.log.push(`${this.label} findOne ${entity.name} ${lock}`);
    return Promise.resolve(this.byId(entity, options.where.id));
  }

  find(
    entity: EntityClass,
    options: { where: { planetId: string } },
  ): Promise<Row[]> {
    this.log.push(`${this.label} find ${entity.name}`);
    return Promise.resolve(
      this.rows(entity)
        .filter((row) => row.planetId === options.where.planetId)
        .map((row) => ({ ...row })),
    );
  }

  /** Only planets are saved through the manager. */
  save(planet: Planet): Promise<Planet> {
    this.log.push(`${this.label} save Planet`);
    this.tables.Planet = this.tables.Planet.map((row) =>
      row.id === planet.id ? { ...planet } : row,
    );
    return Promise.resolve(planet);
  }

  private rows(entity: EntityClass): Row[] {
    return this.tables[entity.name] ?? [];
  }

  private byId(entity: EntityClass, id: string): Row | null {
    const row = this.rows(entity).find((candidate) => candidate.id === id);
    return row ? { ...row } : null;
  }
}

interface Setup {
  service: PlanetStateService;
  clock: FakeClock;
  // Every manager call and every hook, in the order they happened.
  log: string[];
  tables: Record<string, Row[]>;
  // The manager the transaction hands out.
  tx: FakeEntityManager;
}

/**
 * A service over a fake DataSource whose manager reads the tables directly,
 * and whose transaction(run) calls run with a second manager over the same
 * tables, so the log shows which calls ran inside the transaction.
 */
function buildService(): Setup {
  const log: string[] = [];
  const tables: Record<string, Row[]> = { Planet: [planetRow()] };
  const tx = new FakeEntityManager('tx', tables, log);
  const dataSource = {
    manager: new FakeEntityManager('manager', tables, log),
    transaction: <T>(run: (em: FakeEntityManager) => Promise<T>) => run(tx),
  };
  const clock = new FakeClock(T0);
  const service = new PlanetStateService(
    dataSource as unknown as DataSource,
    clock,
  );
  return { service, clock, log, tables, tx };
}

/** The stored planet, as the next transaction would read it. */
function storedPlanet(tables: Record<string, Row[]>): Planet {
  return tables.Planet[0] as Planet;
}

/** Registers one of each hook, each writing its name to the log. */
function registerLoggingHooks({ service, log }: Setup): void {
  service.registerSimulationStep(() => {
    log.push('step 1');
  });
  service.registerSimulationStep(() => {
    log.push('step 2');
  });
  service.registerPostMutationEvaluator(() => {
    log.push('evaluator 1');
  });
  service.registerPostMutationEvaluator(() => {
    log.push('evaluator 2');
  });
  service.registerFactSink(() => {
    log.push('sink 1');
  });
  service.registerFactSink(() => {
    log.push('sink 2');
  });
  service.registerSyncContributor(() => {
    log.push('sync contributor');
    return {};
  });
  service.registerSnapshotContributor(() => {
    log.push('contributor');
    return {};
  });
}

function fact(type: string, occurredAt = T0): Fact {
  return { type, occurredAt, payload: { type } };
}

async function rejection(run: Promise<unknown>): Promise<HttpException> {
  try {
    await run;
  } catch (thrown) {
    return thrown as HttpException;
  }
  throw new Error('expected a rejection');
}

const SNAPSHOT_READS = [
  'find Plant',
  'find Decoration',
  'find InventoryItem',
  'find Unlock',
];

describe('PlanetStateService', () => {
  describe('getSnapshot', () => {
    it('assembles the planet and its own rows at the clock time', async () => {
      const setup = buildService();
      setup.tables.Plant = [
        plantRow('plant-1'),
        plantRow('elsewhere', OTHER_PLANET_ID),
      ];
      setup.tables.Unlock = [
        { planetId: PLANET_ID, itemType: 'clover', unlockedAt: T0 } as Row,
      ];
      setup.clock.set(T1);

      const snapshot = await setup.service.getSnapshot(PLANET_ID);

      expect(snapshot).toMatchObject({
        id: PLANET_ID,
        version: 3,
        serverTime: T1.toISOString(),
        decorations: [],
        inventory: [],
        unlocks: ['clover'],
      });
      expect(snapshot.plants.map((plant) => plant.id)).toEqual(['plant-1']);
    });

    it('reads through the default manager outside a transaction', async () => {
      const setup = buildService();

      await setup.service.getSnapshot(PLANET_ID);

      expect(setup.log).toEqual(
        ['findOneBy Planet', ...SNAPSHOT_READS].map(
          (call) => `manager ${call}`,
        ),
      );
    });

    it('reads through the given entity manager, e.g. a transaction', async () => {
      const setup = buildService();

      await setup.service.getSnapshot(
        PLANET_ID,
        setup.tx as unknown as EntityManager,
      );

      expect(setup.log).toEqual(
        ['findOneBy Planet', ...SNAPSHOT_READS].map((call) => `tx ${call}`),
      );
    });

    it('answers an unknown planet with 404', async () => {
      const { service } = buildService();

      const error = await rejection(service.getSnapshot(OTHER_PLANET_ID));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toMatchObject({
        message: 'This planet has drifted away',
      });
    });

    it('runs contributors in registration order and merges what they return', async () => {
      const { service, tx } = buildService();
      const seen: object[] = [];
      service.registerSnapshotContributor(({ em, planet, snapshot }) => {
        seen.push({
          ...snapshot,
          contributor: 'first',
          em,
          planetId: planet.id,
        });
        return { creatures: ['worm'] };
      });
      service.registerSnapshotContributor(({ em, planet, snapshot }) => {
        seen.push({
          ...snapshot,
          contributor: 'second',
          em,
          planetId: planet.id,
        });
        return { wants: ['a pond'], name: 'Renamed by a later module' };
      });

      const snapshot = await service.getSnapshot(
        PLANET_ID,
        tx as unknown as EntityManager,
      );

      // Each sees the manager, the planet, and what earlier ones added.
      expect(seen).toEqual([
        expect.not.objectContaining({
          creatures: expect.anything() as unknown,
        }),
        expect.objectContaining({ creatures: ['worm'] }),
      ]);
      expect(seen).toMatchObject([
        { contributor: 'first', em: tx, planetId: PLANET_ID },
        { contributor: 'second', em: tx, planetId: PLANET_ID },
      ]);
      expect(snapshot).toMatchObject({
        id: PLANET_ID,
        creatures: ['worm'],
        wants: ['a pond'],
        name: 'Renamed by a later module',
      });
    });
  });

  describe('mutate', () => {
    it('refuses a stale version with 409 reload, and nothing else runs', async () => {
      const setup = buildService();
      registerLoggingHooks(setup);

      const error = await rejection(
        setup.service.mutate(PLANET_ID, 2, () => {
          setup.log.push('apply');
        }),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ message: 'reload' });
      expect(setup.log).toEqual(['tx findOne Planet for_no_key_update']);
      expect(storedPlanet(setup.tables).version).toBe(3);
    });

    it('answers an unknown planet with 404', async () => {
      const { service } = buildService();

      const error = await rejection(service.mutate(OTHER_PLANET_ID, 3));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toMatchObject({
        message: 'This planet has drifted away',
      });
    });

    it('locks the planet, runs steps, command, evaluators and sinks in order, never the sync contributors, then saves and snapshots, all in the transaction', async () => {
      const setup = buildService();
      registerLoggingHooks(setup);

      await setup.service.mutate(PLANET_ID, 3, () => {
        setup.log.push('apply');
      });

      expect(setup.log).toEqual([
        'tx findOne Planet for_no_key_update',
        'step 1',
        'step 2',
        'apply',
        'evaluator 1',
        'evaluator 2',
        'sink 1',
        'sink 2',
        'tx save Planet',
        ...SNAPSHOT_READS.map((call) => `tx ${call}`),
        'contributor',
      ]);
    });

    it('bumps the version by exactly 1 when a command was applied', async () => {
      const { service, tables } = buildService();

      const result = await service.mutate(PLANET_ID, 3, () => {});

      expect(result.snapshot.version).toBe(4);
      expect(storedPlanet(tables).version).toBe(4);
    });

    it('keeps the version without a command, but saves what the steps changed', async () => {
      const { service, tables, clock } = buildService();
      clock.set(T1);
      service.registerSimulationStep((ctx) => {
        ctx.planet.lastSimulatedAt = ctx.now;
      });

      const result = await service.mutate(PLANET_ID, 3);

      expect(result.snapshot.version).toBe(3);
      expect(storedPlanet(tables)).toMatchObject({
        version: 3,
        lastSimulatedAt: T1,
      });
    });

    it('leaves lastSeenAt alone, with or without a command', async () => {
      const { service, tables, clock } = buildService();
      clock.set(T1);

      await service.mutate(PLANET_ID, 3, () => {});
      await service.mutate(PLANET_ID, 4);

      expect(storedPlanet(tables).lastSeenAt).toEqual(T0);
    });

    it('hands every hook the same context, with the clock read once', async () => {
      const { service, clock, tx } = buildService();
      const contexts: MutationContext[] = [];
      service.registerSimulationStep((ctx) => {
        contexts.push(ctx);
        clock.advance(60_000);
      });
      service.registerPostMutationEvaluator((ctx) => {
        contexts.push(ctx);
      });
      service.registerFactSink((ctx) => {
        contexts.push(ctx);
      });

      const result = await service.mutate(PLANET_ID, 3, (ctx) => {
        contexts.push(ctx);
      });

      expect(contexts).toHaveLength(4);
      for (const ctx of contexts) {
        expect(ctx).toBe(contexts[0]);
      }
      expect(contexts[0].em).toBe(tx);
      expect(contexts[0].planet.id).toBe(PLANET_ID);
      expect(contexts[0].now).toEqual(T0);
      // The snapshot is taken at the instant the mutation ran at.
      expect(result.snapshot.serverTime).toBe(T0.toISOString());
    });

    it('hands the hooks lastSimulatedAt as it was before the steps moved it, as previousSimulatedAt', async () => {
      const { service, clock } = buildService();
      clock.set(T1);
      const seen: Date[] = [];
      service.registerSimulationStep((ctx) => {
        ctx.planet.lastSimulatedAt = ctx.now;
      });
      service.registerPostMutationEvaluator((ctx) => {
        seen.push(ctx.previousSimulatedAt, ctx.planet.lastSimulatedAt);
      });

      await service.mutate(PLANET_ID, 3);

      expect(seen).toEqual([T0, T1]);
    });

    it('passes the facts of every hook to the sinks and returns them as events', async () => {
      const { service } = buildService();
      const sunk: Fact[][] = [];
      service.registerSimulationStep((ctx) => {
        ctx.facts.push(fact('bloomed', T1));
      });
      service.registerPostMutationEvaluator((ctx) => {
        ctx.facts.push(fact('arrived'));
        ctx.newlyUnlocked.push('pond');
      });
      service.registerFactSink((_ctx, facts) => {
        sunk.push([...facts]);
      });

      const result = await service.mutate(PLANET_ID, 3, (ctx) => {
        ctx.facts.push(fact('planted'));
        ctx.newlyUnlocked.push('tulip');
      });

      const facts = [fact('bloomed', T1), fact('planted'), fact('arrived')];
      expect(sunk).toEqual([facts]);
      expect(result.events).toEqual(
        facts.map((f) => ({
          type: f.type,
          occurredAt: f.occurredAt.toISOString(),
          payload: f.payload,
        })),
      );
      expect(result.newlyUnlocked).toEqual(['tulip', 'pond']);
    });

    it('returns a snapshot that shows what the command wrote', async () => {
      const { service, tables } = buildService();

      const result = await service.mutate(PLANET_ID, 3, () => {
        // Stands in for an insert through ctx.em.
        tables.Plant = [plantRow('new-plant')];
      });

      expect(result.snapshot.plants.map((plant) => plant.id)).toEqual([
        'new-plant',
      ]);
    });

    it('stops at a throwing command: no evaluator, sink or save runs', async () => {
      const setup = buildService();
      registerLoggingHooks(setup);

      await expect(
        setup.service.mutate(PLANET_ID, 3, () => {
          throw new Error('wilted');
        }),
      ).rejects.toThrow('wilted');

      expect(setup.log).toEqual([
        'tx findOne Planet for_no_key_update',
        'step 1',
        'step 2',
      ]);
      expect(storedPlanet(setup.tables).version).toBe(3);
    });
  });

  describe('sync', () => {
    it('refuses a stale version with 409 reload, and nothing else runs', async () => {
      const setup = buildService();
      registerLoggingHooks(setup);
      setup.clock.set(T1);

      const error = await rejection(setup.service.sync(PLANET_ID, 2));

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ message: 'reload' });
      expect(setup.log).toEqual(['tx findOne Planet for_no_key_update']);
      expect(storedPlanet(setup.tables)).toMatchObject({
        version: 3,
        lastSeenAt: T0,
      });
    });

    it('answers an unknown planet with 404', async () => {
      const { service } = buildService();

      const error = await rejection(service.sync(OTHER_PLANET_ID, 3));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toMatchObject({
        message: 'This planet has drifted away',
      });
    });

    it('runs steps, evaluators, sinks and sync contributors in order, then saves and snapshots, all in the transaction', async () => {
      const setup = buildService();
      registerLoggingHooks(setup);

      await setup.service.sync(PLANET_ID, 3);

      expect(setup.log).toEqual([
        'tx findOne Planet for_no_key_update',
        'step 1',
        'step 2',
        'evaluator 1',
        'evaluator 2',
        'sink 1',
        'sink 2',
        'sync contributor',
        'tx save Planet',
        ...SNAPSHOT_READS.map((call) => `tx ${call}`),
        'contributor',
      ]);
    });

    it('never changes the version, so a second sync on it succeeds too', async () => {
      const { service, tables } = buildService();

      const first = await service.sync(PLANET_ID, 3);
      const second = await service.sync(PLANET_ID, 3);

      expect(first.snapshot.version).toBe(3);
      expect(second.snapshot.version).toBe(3);
      expect(storedPlanet(tables).version).toBe(3);
    });

    it('sets lastSeenAt to the clock time, after the hooks saw the previous one', async () => {
      const { service, tables, clock } = buildService();
      clock.set(T1);
      const seenByHooks: Date[] = [];
      service.registerSimulationStep((ctx) => {
        seenByHooks.push(ctx.planet.lastSeenAt);
      });
      service.registerFactSink((ctx) => {
        seenByHooks.push(ctx.planet.lastSeenAt);
      });

      await service.sync(PLANET_ID, 3);

      expect(seenByHooks).toEqual([T0, T0]);
      expect(storedPlanet(tables).lastSeenAt).toEqual(T1);
    });

    it('hands sync contributors the context and the previous visit, and merges what they return in order', async () => {
      const { service, clock, tx } = buildService();
      clock.set(T1);
      const seen: { em: unknown; now: Date; previous: Date; facts: number }[] =
        [];
      service.registerSimulationStep((ctx) => {
        ctx.facts.push(fact('bloomed'));
      });
      service.registerSyncContributor((ctx, previous) => {
        seen.push({
          em: ctx.em,
          now: ctx.now,
          previous,
          facts: ctx.facts.length,
        });
        return { welcomeBack: { summary: ['first'] }, extra: 1 };
      });
      service.registerSyncContributor(() =>
        Promise.resolve({ welcomeBack: { summary: ['second'] } }),
      );

      const result = await service.sync(PLANET_ID, 3);

      expect(seen).toEqual([{ em: tx, now: T1, previous: T0, facts: 1 }]);
      expect(result).toMatchObject({
        welcomeBack: { summary: ['second'] },
        extra: 1,
      });
      expect(result.events.map((event) => event.type)).toEqual(['bloomed']);
    });

    it('answers just the snapshot, events and unlocks when the contributors add nothing', async () => {
      const { service } = buildService();
      service.registerSyncContributor(() => ({}));

      const result = await service.sync(PLANET_ID, 3);

      expect(Object.keys(result).sort()).toEqual([
        'events',
        'newlyUnlocked',
        'snapshot',
      ]);
    });

    it('returns what a hook unlocked during the heartbeat (ITM-04 AC3)', async () => {
      const { service } = buildService();
      service.registerPostMutationEvaluator((ctx) => {
        ctx.newlyUnlocked.push('tulip');
      });

      const result = await service.sync(PLANET_ID, 3);

      expect(result.newlyUnlocked).toEqual(['tulip']);
    });

    it('returns the snapshot at the clock time and the facts as events, nothing more', async () => {
      const { service, clock } = buildService();
      clock.set(T1);
      service.registerSimulationStep((ctx) => {
        ctx.facts.push(fact('bloomed'));
      });
      service.registerPostMutationEvaluator((ctx) => {
        ctx.facts.push(fact('arrived', T1));
      });

      const result = await service.sync(PLANET_ID, 3);

      expect(Object.keys(result).sort()).toEqual([
        'events',
        'newlyUnlocked',
        'snapshot',
      ]);
      expect(result.snapshot).toMatchObject({
        id: PLANET_ID,
        serverTime: T1.toISOString(),
      });
      expect(result.events.map((event) => event.type)).toEqual([
        'bloomed',
        'arrived',
      ]);
    });
  });
});
