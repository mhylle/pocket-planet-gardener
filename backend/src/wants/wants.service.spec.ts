import type { EntityManager } from 'typeorm';
import { FakeClock } from '../../test/support/fake-clock';
import { SeededRandom } from '../../test/support/seeded-random';
import { THANK_YOU_LINES } from '../content/thank-you-lines';
import type { Creature } from '../creatures/creature.entity';
import type { GameConfigService } from '../game-config/game-config.service';
import type { GrantItem } from '../inventory/inventory.service';
import type { PlanetSnapshotDto } from '../planets/dto/planet-snapshot.dto';
import type {
  MutationContext,
  PostMutationEvaluator,
  SimulationStep,
  SnapshotContributor,
} from '../planets/planet-state/mutation.types';
import type { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type { Planet } from '../planets/planet.entity';
import type { RewardService } from './reward.service';
import type {
  GeneratedWant,
  WantGenerationService,
  WantRequest,
} from './want-generation.service';
import type { Want } from './want.entity';
import { WantsService } from './wants.service';

const PLANET_ID = 'planet-1';
const HOUR_MS = 3_600_000;
const CONFIG = {
  overjoyedGiftHours: 24,
  wantCooldownMinutes: 60,
} as GameConfigService;
const REWARD: GrantItem[] = [{ itemType: 'tulip', kind: 'seed', count: 2 }];
const GIFT: GrantItem = { itemType: 'clover', kind: 'seed', count: 3 };
const BENCH_WANT: GeneratedWant = {
  spec: { type: 'place-decoration', decoration: 'bench' },
  text: 'A bench would be lovely.',
  plainDescription: 'A bench on the planet',
  source: 'fallback',
};

type Row = Record<string, unknown>;

/**
 * Rows per entity name, all of the one planet; find() filters on the other
 * plain where values and honours take.
 */
function fakeEm(tables: Record<string, object[]>) {
  const updates: { entity: string; id: unknown; values: Row }[] = [];
  const inserts: { entity: string; values: Row }[] = [];
  const matches = (row: object, where: Row = {}) =>
    Object.entries(where).every(
      ([key, value]) =>
        key === 'planetId' ||
        typeof value === 'object' ||
        (row as Row)[key] === value,
    );
  const em = {
    find: (
      entity: { name: string },
      options: { where?: Row; take?: number } = {},
    ) => {
      const rows = (tables[entity.name] ?? []).filter((row) =>
        matches(row, options.where),
      );
      return Promise.resolve(rows.slice(0, options.take ?? rows.length));
    },
    findOneBy: (entity: { name: string }, where: Row) =>
      Promise.resolve(
        (tables[entity.name] ?? []).find((row) => matches(row, where)) ?? null,
      ),
    update: (
      entity: { name: string },
      criteria: { id: unknown },
      values: Row,
    ) => {
      updates.push({ entity: entity.name, id: criteria.id, values });
      return Promise.resolve();
    },
    insert: (entity: { name: string }, values: Row) => {
      inserts.push({ entity: entity.name, values });
      return Promise.resolve();
    },
  };
  return { em: em as unknown as EntityManager, updates, inserts };
}

function creature(
  name: string,
  species: Creature['species'],
  extra: Partial<Creature> = {},
): Creature {
  return {
    id: `creature-${name}`,
    planetId: PLANET_ID,
    species,
    name,
    identity: {
      traits: ['calm', 'kind'],
      quirk: 'It hums.',
      speakingStyle: 'softly',
      backstory: 'It has lived here a while.',
      summary: `${name} lives here.`,
    },
    identitySource: 'ai',
    mood: 'content',
    moodSince: new Date('2030-01-01T00:00:00.000Z'),
    wistful: false,
    lat: 0,
    lon: 0,
    arrivedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...extra,
  } as Creature;
}

function want(owner: Creature, extra: Partial<Want> = {}): Want {
  return {
    id: `want-${owner.name}`,
    creatureId: owner.id,
    planetId: PLANET_ID,
    spec: { type: 'count-blooming', plant: 'clover', count: 1 },
    text: 'One clover in bloom, please.',
    plainDescription: '1 clover in bloom',
    status: 'active',
    source: 'ai',
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    resolvedAt: null,
    ...extra,
  } as Want;
}

function setup(tables: Record<string, object[]>) {
  const steps: SimulationStep[] = [];
  const evaluators: PostMutationEvaluator[] = [];
  const contributors: SnapshotContributor[] = [];
  const planetState = {
    registerSimulationStep: (step: SimulationStep) => steps.push(step),
    registerPostMutationEvaluator: (evaluator: PostMutationEvaluator) =>
      evaluators.push(evaluator),
    registerSnapshotContributor: (contributor: SnapshotContributor) =>
      contributors.push(contributor),
  };
  const requests: WantRequest[] = [];
  const generation = {
    generate: (request: WantRequest) => {
      requests.push(request);
      return Promise.resolve(BENCH_WANT);
    },
  };
  const rewards = {
    rewardFor: () => Promise.resolve(REWARD),
    giftFor: () => Promise.resolve(GIFT),
  };
  const service = new WantsService(
    planetState as unknown as PlanetStateService,
    generation as unknown as WantGenerationService,
    rewards as unknown as RewardService,
    CONFIG,
    new SeededRandom(),
  );
  service.onModuleInit();
  const { em, updates, inserts } = fakeEm(tables);
  const planet = { id: PLANET_ID, name: 'Moonbeam', maxPlants: 60 } as Planet;
  const clock = new FakeClock();
  const ctx = (): MutationContext => ({
    em,
    planet,
    now: clock.now(),
    previousSimulatedAt: clock.now(),
    facts: [],
    newlyUnlocked: [],
  });
  return {
    steps,
    evaluators,
    contributors,
    requests,
    updates,
    inserts,
    clock,
    ctx,
    em,
    planet,
  };
}

const bloom = { type: 'clover', stage: 'bloom', lat: 0, lon: 0 };
const pond = { type: 'pond', lat: 20, lon: 0 };

describe('WantsService', () => {
  it('registers a simulation step, an evaluator and a snapshot contributor', () => {
    const { steps, evaluators, contributors } = setup({});

    expect(
      [steps, evaluators, contributors].map((list) => list.length),
    ).toEqual([1, 1, 1]);
  });

  describe('gift step (CRT-04 AC2)', () => {
    it('gives one gift a day after the creature became overjoyed, then it is cheerful', async () => {
      const since = new Date('2030-01-01T00:00:00.000Z');
      const mira = creature('Mira', 'snail', {
        mood: 'overjoyed',
        moodSince: since,
      });
      const { steps, clock, ctx, updates } = setup({ Creature: [mira] });

      clock.advance(23 * HOUR_MS);
      const early = ctx();
      await steps[0](early);
      expect(early.facts).toEqual([]);

      clock.advance(2 * HOUR_MS);
      const due = ctx();
      await steps[0](due);

      const dueAt = new Date(since.getTime() + 24 * HOUR_MS);
      expect(due.facts).toEqual([
        {
          type: 'gift-received',
          occurredAt: dueAt,
          payload: {
            creatureId: mira.id,
            name: 'Mira',
            species: 'snail',
            lat: 0,
            lon: 0,
            item: GIFT,
          },
        },
      ]);
      expect(updates).toEqual([
        {
          entity: 'Creature',
          id: mira.id,
          values: { mood: 'cheerful', moodSince: dueAt },
        },
      ]);
    });
  });

  describe('evaluator', () => {
    it('fulfils a met want with a thank-you, a mood lift, a memory and a reward (WNT-03, WNT-04)', async () => {
      const mira = creature('Mira', 'worm');
      const { evaluators, ctx, updates, inserts, requests } = setup({
        Creature: [mira],
        Plant: [bloom],
        Want: [want(mira)],
      });
      const run = ctx();

      await evaluators[0](run);

      expect(updates).toEqual([
        {
          entity: 'Want',
          id: 'want-Mira',
          values: { status: 'fulfilled', resolvedAt: run.now },
        },
        {
          entity: 'Creature',
          id: mira.id,
          values: { mood: 'cheerful', moodSince: run.now },
        },
      ]);
      expect(inserts).toEqual([
        {
          entity: 'CreatureMemory',
          values: {
            creatureId: mira.id,
            kind: 'want',
            text: 'The gardener granted my wish: 1 clover in bloom',
            createdAt: run.now,
          },
        },
      ]);
      expect(run.facts).toEqual([
        {
          type: 'want-fulfilled',
          occurredAt: run.now,
          payload: {
            creatureId: mira.id,
            name: 'Mira',
            species: 'worm',
            lat: 0,
            lon: 0,
            wantText: 'One clover in bloom, please.',
            thankYou: expect.any(String) as unknown,
            reward: REWARD,
          },
        },
      ]);
      expect(THANK_YOU_LINES.worm).toContain(run.facts[0].payload.thankYou);
      // Its cooldown has only just started.
      expect(requests).toEqual([]);
    });

    it('keeps an overjoyed creature overjoyed from when it got there', async () => {
      const mira = creature('Mira', 'worm', { mood: 'overjoyed' });
      const { evaluators, ctx, updates } = setup({
        Creature: [mira],
        Plant: [bloom],
        Want: [want(mira)],
      });

      await evaluators[0](ctx());

      expect(updates.map((update) => update.entity)).toEqual(['Want']);
    });

    it('leaves an unmet want active, however old (WNT-05 AC3)', async () => {
      const mira = creature('Mira', 'worm');
      const { evaluators, clock, ctx, updates, requests } = setup({
        Creature: [mira],
        Plant: [{ ...bloom, stage: 'young' }],
        Want: [want(mira)],
      });
      clock.advance(30 * 24 * HOUR_MS);
      const run = ctx();

      await evaluators[0](run);

      expect(updates.filter((update) => update.entity === 'Want')).toEqual([]);
      expect(run.facts).toEqual([]);
      expect(requests).toEqual([]);
    });

    it('marks the snail wistful once its pond is gone (CRT-04 AC3)', async () => {
      const shelly = creature('Shelly', 'snail');
      const { evaluators, ctx, updates } = setup({
        Creature: [shelly],
        Plant: [bloom, bloom, bloom],
        Want: [
          want(shelly, {
            spec: { type: 'place-decoration', decoration: 'bench' },
          }),
        ],
      });

      await evaluators[0](ctx());

      expect(updates).toEqual([
        { entity: 'Creature', id: shelly.id, values: { wistful: true } },
      ]);
    });

    it('asks a wistful snail for its pond back', async () => {
      const shelly = creature('Shelly', 'snail', { wistful: true });
      const old = want(shelly, {
        status: 'dismissed',
        resolvedAt: new Date('2029-12-31T00:00:00.000Z'),
      });
      const { evaluators, ctx, requests } = setup({
        Creature: [shelly],
        Plant: [bloom, bloom, bloom],
        Want: [old],
      });

      await evaluators[0](ctx());

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        tutorial: false,
        bringBack: { itemKind: 'decoration', item: 'pond' },
      });
    });

    it('gives one new want per mutation, the planet’s first as the tutorial want (ONB-02 AC3)', async () => {
      const worm = creature('Wiggles', 'worm');
      const snail = creature('Shelly', 'snail');
      const { evaluators, ctx, inserts, requests } = setup({
        Creature: [worm, snail],
        Plant: [bloom, bloom, bloom],
        Decoration: [pond],
        InventoryItem: [{ itemType: 'clover', count: 3 }],
        Unlock: [{ itemType: 'clover' }, { itemType: 'bench' }],
      });
      const run = ctx();

      await evaluators[0](run);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        planetId: PLANET_ID,
        creature: {
          id: worm.id,
          species: 'worm',
          name: 'Wiggles',
          home: { lat: 0, lon: 0 },
        },
        tutorial: true,
        bringBack: undefined,
        maxPlants: 60,
        plantCount: 3,
      });
      expect([...requests[0].unlocked]).toEqual(['clover', 'bench']);
      expect([...(requests[0].owned ?? [])]).toEqual([['clover', 3]]);
      expect(inserts).toEqual([
        {
          entity: 'Want',
          values: {
            creatureId: worm.id,
            planetId: PLANET_ID,
            ...BENCH_WANT,
            status: 'active',
            createdAt: run.now,
            resolvedAt: null,
          },
        },
      ]);
    });

    it('asks for no want in a mutation that brought a creature', async () => {
      const { evaluators, ctx, requests } = setup({
        Creature: [creature('Wiggles', 'worm')],
        Plant: [bloom],
      });
      const run = ctx();
      run.facts.push({
        type: 'creature-arrived',
        occurredAt: run.now,
        payload: {},
      });

      await evaluators[0](run);

      expect(requests).toEqual([]);
    });

    it('waits the cooldown after "Maybe later" (WNT-05 AC1)', async () => {
      const mira = creature('Mira', 'worm');
      const resolvedAt = new Date('2030-01-01T00:00:00.000Z');
      const { evaluators, clock, ctx, requests } = setup({
        Creature: [mira],
        Plant: [bloom],
        Want: [want(mira, { status: 'dismissed', resolvedAt })],
      });

      clock.advance(59 * 60_000);
      await evaluators[0](ctx());
      expect(requests).toEqual([]);

      clock.advance(60_000);
      await evaluators[0](ctx());
      expect(requests).toHaveLength(1);
    });
  });

  it('puts each creature’s active want on the snapshot, or null', async () => {
    const mira = creature('Mira', 'worm');
    const pip = creature('Pip', 'bee');
    const { contributors, em, planet } = setup({
      Want: [want(mira), want(pip, { id: 'want-old', status: 'fulfilled' })],
    });
    const snapshot = {
      creatures: [{ id: mira.id }, { id: pip.id }],
    } as PlanetSnapshotDto;

    const slice = await contributors[0]({ em, planet, snapshot });

    expect(slice).toEqual({
      creatures: [
        {
          id: mira.id,
          want: {
            id: 'want-Mira',
            type: 'count-blooming',
            text: 'One clover in bloom, please.',
            plainDescription: '1 clover in bloom',
            spec: { type: 'count-blooming', plant: 'clover', count: 1 },
          },
        },
        { id: pip.id, want: null },
      ],
    });
  });
});
