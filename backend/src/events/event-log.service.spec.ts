import type { DataSource, EntityManager } from 'typeorm';
import type {
  Fact,
  FactSink,
  MutationContext,
} from '../planets/planet-state/mutation.types';
import type { PlanetStateService } from '../planets/planet-state/planet-state.service';
import { EventLogService } from './event-log.service';

const PLANET_ID = 'planet-1';
const OTHER_PLANET_ID = 'planet-2';
const T1 = new Date('2030-01-01T01:00:00.000Z');
const T2 = new Date('2030-01-01T02:00:00.000Z');

type Row = Record<string, unknown>;

/**
 * The slice of EntityManager the service writes with, over one in-memory
 * events table. Criteria are plain equality; the since() query and its order
 * are the database's job, covered by test/events.e2e-spec.ts.
 */
class FakeEntityManager {
  readonly events: Row[] = [];
  queries = 0;

  existsBy(_entity: unknown, where: Row): Promise<boolean> {
    this.queries++;
    return Promise.resolve(
      this.events.some((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      ),
    );
  }

  save(_entity: unknown, rows: Row[]): Promise<Row[]> {
    this.queries++;
    this.events.push(...rows);
    return Promise.resolve(rows);
  }
}

function setup() {
  const em = new FakeEntityManager();
  const sinks: FactSink[] = [];
  const planetState = {
    registerFactSink: (sink: FactSink) => sinks.push(sink),
  };
  const service = new EventLogService(
    planetState as unknown as PlanetStateService,
    {} as DataSource,
  );
  const append = (facts: Fact[], planetId = PLANET_ID) =>
    service.append(em as unknown as EntityManager, planetId, facts);
  return { em, sinks, service, append };
}

function bloom(occurredAt: Date, plantId = 'plant-1'): Fact {
  return {
    type: 'plant-bloomed',
    occurredAt,
    payload: { plantId, type: 'sunflower', lat: 10, lon: 20 },
  };
}

function stage(occurredAt: Date): Fact {
  return {
    type: 'plant-stage',
    occurredAt,
    payload: { plantId: 'plant-1', type: 'sunflower', stage: 'sprout' },
  };
}

describe('EventLogService', () => {
  it('appends every fact of a mutation as an event of the planet', async () => {
    const { em, append } = setup();

    await append([stage(T1), stage(T2)]);

    expect(em.events).toEqual([
      {
        planetId: PLANET_ID,
        type: 'plant-stage',
        payload: stage(T1).payload,
        occurredAt: T1,
        isMilestone: false,
      },
      {
        planetId: PLANET_ID,
        type: 'plant-stage',
        payload: stage(T2).payload,
        occurredAt: T2,
        isMilestone: false,
      },
    ]);
  });

  it('marks the first ever bloom as a milestone, and no later one (JRN-03 AC2)', async () => {
    const { em, append } = setup();

    await append([stage(T1), bloom(T2, 'first')]);
    await append([bloom(T2, 'second')]);

    expect(em.events.map((row) => [row.type, row.isMilestone])).toEqual([
      ['plant-stage', false],
      ['plant-bloomed', true],
      ['plant-bloomed', false],
    ]);
  });

  it('marks only the earliest of several first blooms in one mutation', async () => {
    const { em, append } = setup();

    await append([bloom(T2, 'later'), bloom(T1, 'earlier')]);

    expect(
      em.events.map((row) => [(row.payload as Row).plantId, row.isMilestone]),
    ).toEqual([
      ['later', false],
      ['earlier', true],
    ]);
  });

  it('counts blooms per planet', async () => {
    const { em, append } = setup();

    await append([bloom(T1)], OTHER_PLANET_ID);
    await append([bloom(T2)]);

    expect(em.events.map((row) => row.isMilestone)).toEqual([true, true]);
  });

  it('marks a fact whose payload says milestone: true', async () => {
    const { em, append } = setup();

    await append([
      {
        type: 'creature-arrived',
        occurredAt: T1,
        payload: { milestone: true },
      },
      { type: 'creature-arrived', occurredAt: T2, payload: {} },
    ]);

    expect(em.events.map((row) => row.isMilestone)).toEqual([true, false]);
  });

  it('touches nothing for a mutation without facts', async () => {
    const { em, append } = setup();

    await append([]);

    expect(em.queries).toBe(0);
  });

  it('registers as a fact sink that appends through the mutation transaction', async () => {
    const { em, sinks, service } = setup();
    service.onModuleInit();
    const ctx = {
      em,
      planet: { id: PLANET_ID },
    } as unknown as MutationContext;

    await sinks[0](ctx, [stage(T1)]);

    expect(sinks).toHaveLength(1);
    expect(em.events).toMatchObject([
      { planetId: PLANET_ID, type: 'plant-stage' },
    ]);
  });
});
