import type { EntityManager } from 'typeorm';
import type { GameConfigService } from '../game-config/game-config.service';
import type { Decoration } from '../garden/decoration.entity';
import type { Plant } from '../garden/plant.entity';
import type { PlanetSnapshotDto } from '../planets/dto/planet-snapshot.dto';
import type {
  MutationContext,
  PostMutationEvaluator,
  SnapshotContributor,
} from '../planets/planet-state/mutation.types';
import type { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type { Planet } from '../planets/planet.entity';
import type { Creature } from './creature.entity';
import { CreaturesService } from './creatures.service';
import type { IdentityService } from './identity.service';
import type { CreatureIdentity, IdentityRequest } from './identity.types';

const PLANET_ID = 'planet-1';
const T0 = new Date('2030-01-01T00:00:00.000Z');
const CONFIG = {
  arrivalDelaySeconds: 120,
  arrivalSpacingMinutes: 30,
  maxCreatures: 8,
  maxPerSpecies: 2,
  syncIntervalSeconds: 10,
} as GameConfigService;

const MOSS: CreatureIdentity = {
  name: 'Moss',
  traits: ['calm', 'curious'],
  quirk: 'It counts raindrops.',
  speakingStyle: 'slow and soft',
  backstory: 'Moss came for the clover.',
  summary: 'A calm snail who counts raindrops.',
};

function plant(id: string, lat: number, stage = 'bloom'): Plant {
  return {
    id,
    planetId: PLANET_ID,
    type: 'clover',
    lat,
    lon: 0,
    stage,
  } as Plant;
}

/** A creature living on the planet; Pebble's identity came from the pool. */
function resident(name: string, species: Creature['species']): Creature {
  const { traits, quirk, speakingStyle, backstory } = MOSS;
  const row: Omit<Creature, 'planet'> = {
    id: `creature-${name}`,
    planetId: PLANET_ID,
    species,
    name,
    identity: {
      traits,
      quirk,
      speakingStyle,
      backstory,
      summary: `${name} lives here.`,
    },
    identitySource: name === 'Pebble' ? 'fallback' : 'ai',
    mood: 'content',
    moodSince: T0,
    wistful: false,
    lat: -60,
    lon: 0,
    arrivedAt: T0,
  };
  return row as Creature;
}

/** Answers find() per entity from fixed rows and records what is saved. */
function fakeEm(rows: {
  plants: Plant[];
  decorations: Partial<Decoration>[];
  creatures: Creature[];
}) {
  const saved: Partial<Creature>[] = [];
  const em = {
    find: (entity: { name: string }) =>
      Promise.resolve(
        {
          Plant: rows.plants,
          Decoration: rows.decorations,
          Creature: rows.creatures,
        }[entity.name] ?? [],
      ),
    create: (_entity: unknown, values: Partial<Creature>) => ({ ...values }),
    save: (values: Partial<Creature>) => {
      saved.push(values);
      return Promise.resolve({ ...values, id: 'creature-new' });
    },
  };
  return { em: em as unknown as EntityManager, saved };
}

function setup(rows: Parameters<typeof fakeEm>[0]) {
  const evaluators: PostMutationEvaluator[] = [];
  const contributors: SnapshotContributor[] = [];
  const planetState = {
    registerPostMutationEvaluator: (evaluator: PostMutationEvaluator) =>
      evaluators.push(evaluator),
    registerSnapshotContributor: (contributor: SnapshotContributor) =>
      contributors.push(contributor),
  };
  const requests: IdentityRequest[] = [];
  const identities = {
    create: (request: IdentityRequest) => {
      requests.push(request);
      return Promise.resolve({ identity: MOSS, source: 'ai' as const });
    },
  };
  const service = new CreaturesService(
    planetState as unknown as PlanetStateService,
    identities as unknown as IdentityService,
    CONFIG,
  );
  service.onModuleInit();
  const { em, saved } = fakeEm(rows);
  const planet = {
    id: PLANET_ID,
    name: 'Moonbeam',
    maxPlants: 60,
    arrivalTracking: {},
  } as Planet;
  const ctxAfter = (seconds: number): MutationContext => ({
    em,
    planet,
    now: new Date(T0.getTime() + seconds * 1000),
    previousSimulatedAt: T0,
    facts: [],
    newlyUnlocked: [],
  });
  return {
    service,
    evaluators,
    contributors,
    requests,
    saved,
    planet,
    em,
    ctxAfter,
  };
}

const SNAIL_GARDEN = {
  plants: [plant('p1', 0), plant('p2', 10), plant('p3', 20)],
  decorations: [{ id: 'd1', type: 'pond' as const, lat: -20, lon: 40 }],
};

describe('CreaturesService', () => {
  it('registers one evaluator and one snapshot contributor', () => {
    const { evaluators, contributors } = setup({
      ...SNAIL_GARDEN,
      creatures: [],
    });

    expect(evaluators).toHaveLength(1);
    expect(contributors).toHaveLength(1);
  });

  it('only tracks the condition during live play, and calls no AI', async () => {
    const { service, requests, saved, planet, ctxAfter } = setup({
      ...SNAIL_GARDEN,
      creatures: [resident('Wiggles', 'worm')],
    });

    // 30 seconds is three heartbeats: still live, so the delay applies.
    const ctx = ctxAfter(30);
    await service.arrive(ctx);

    expect(planet.arrivalTracking.species?.snail).toEqual({
      metSince: ctx.now.toISOString(),
    });
    expect(requests).toEqual([]);
    expect(saved).toEqual([]);
    expect(ctx.facts).toEqual([]);
  });

  it('moves the snail in at once after away time, by the pond, with a public-only identity request', async () => {
    const { service, requests, saved, ctxAfter } = setup({
      ...SNAIL_GARDEN,
      creatures: [resident('Wiggles', 'worm'), resident('Pebble', 'bee')],
    });

    const ctx = ctxAfter(31);
    await service.arrive(ctx);

    expect(requests).toEqual([
      {
        species: 'snail',
        planetId: PLANET_ID,
        planet: {
          name: 'Moonbeam',
          plants: [
            { type: 'clover', stage: 'bloom' },
            { type: 'clover', stage: 'bloom' },
            { type: 'clover', stage: 'bloom' },
          ],
          decorations: [{ type: 'pond' }],
          creatures: [
            {
              name: 'Wiggles',
              species: 'worm',
              summary: 'Wiggles lives here.',
            },
            { name: 'Pebble', species: 'bee', summary: 'Pebble lives here.' },
          ],
        },
        existingNames: ['Wiggles', 'Pebble'],
        usedFallbackNames: ['Pebble'],
      },
    ]);
    const { name, ...identity } = MOSS;
    expect(saved).toEqual([
      {
        planetId: PLANET_ID,
        species: 'snail',
        name,
        identity,
        identitySource: 'ai',
        mood: 'content',
        moodSince: ctx.now,
        wistful: false,
        lat: expect.any(Number) as unknown,
        lon: expect.any(Number) as unknown,
        arrivedAt: ctx.now,
      },
    ]);
    const { lat, lon } = saved[0] as { lat: number; lon: number };
    expect(ctx.facts).toEqual([
      {
        type: 'creature-arrived',
        occurredAt: ctx.now,
        payload: {
          creatureId: 'creature-new',
          species: 'snail',
          name,
          lat,
          lon,
          milestone: true,
        },
      },
    ]);
  });

  it('serves the creatures picked by name, without the planet id', async () => {
    const worm = resident('Wiggles', 'worm');
    const { contributors, em, planet } = setup({
      plants: [],
      decorations: [],
      creatures: [worm],
    });

    const slice = await contributors[0]({
      em,
      planet,
      snapshot: {} as PlanetSnapshotDto,
    });

    expect(slice).toEqual({
      creatures: [
        {
          id: worm.id,
          species: 'worm',
          name: 'Wiggles',
          summary: 'Wiggles lives here.',
          traits: MOSS.traits,
          quirk: MOSS.quirk,
          speakingStyle: MOSS.speakingStyle,
          backstory: MOSS.backstory,
          mood: 'content',
          wistful: false,
          lat: -60,
          lon: 0,
          arrivedAt: T0.toISOString(),
          identitySource: 'ai',
          want: null,
        },
      ],
    });
  });
});
