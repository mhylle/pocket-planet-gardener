import type { EntityManager } from 'typeorm';
import { FakeClock } from '../../test/support/fake-clock';
import type { PlantId } from '../content/content.types';
import { GameConfigService } from '../game-config/game-config.service';
import type { Plant } from '../garden/plant.entity';
import type { PlanetSnapshotDto } from '../planets/dto/planet-snapshot.dto';
import type {
  Fact,
  MutationContext,
  SimulationStep,
  SnapshotContributor,
} from '../planets/planet-state/mutation.types';
import type { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type { Planet } from '../planets/planet.entity';
import { SimulationService } from './simulation.service';

const PLANET_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// On the 15-minute grid, and at sun angle 0 with the default 60-minute day.
const T0 = new Date('2030-01-01T00:00:00.000Z');

/** GameConfigService over a stub ConfigService, as in its own spec. */
function config(env: Record<string, string> = {}): GameConfigService {
  return new GameConfigService({ get: (key: string) => env[key] } as never);
}

function planetRow(lastSimulatedAt: Date): Planet {
  return {
    id: PLANET_ID,
    code: 'MOON2345',
    name: 'Moonbeam',
    radiusLevel: 1,
    maxPlants: 60,
    version: 3,
    lastSimulatedAt,
    lastSeenAt: lastSimulatedAt,
    sunOverrideAngle: null,
    sunOverrideAt: null,
    tutorialStep: 0,
    clouds: [],
    arrivalTracking: {},
    rewardCounter: 0,
    settings: {},
    createdAt: T0,
  };
}

function plantRow(
  id: string,
  type: PlantId,
  water: number,
  spot = { lat: 0, lon: 0 },
): Plant {
  return {
    id,
    planetId: PLANET_ID,
    type,
    ...spot,
    stage: 'seed',
    growth: 0,
    water,
    plantedAt: T0,
    lastHarvestedAt: null,
    harvestReady: false,
  } as Plant;
}

/** A clover in bloom whose seeds were picked at harvestedAt. */
function harvestedRow(id: string, harvestedAt: Date | null): Plant {
  return {
    ...plantRow(id, 'clover', 0.5),
    stage: 'bloom',
    growth: 1,
    lastHarvestedAt: harvestedAt,
  };
}

/** The slice of EntityManager the step uses, over one planet's plants. */
class FakeEntityManager {
  readonly saved: Plant[][] = [];

  constructor(private readonly plants: Plant[]) {}

  find(): Promise<Plant[]> {
    return Promise.resolve(this.plants);
  }

  save(plants: Plant[]): Promise<Plant[]> {
    this.saved.push(plants);
    return Promise.resolve(plants);
  }
}

/** Keeps what the service registers, as PlanetStateService would. */
class FakePlanetState {
  readonly steps: SimulationStep[] = [];
  readonly contributors: SnapshotContributor[] = [];

  registerSimulationStep(step: SimulationStep): void {
    this.steps.push(step);
  }

  registerSnapshotContributor(contributor: SnapshotContributor): void {
    this.contributors.push(contributor);
  }
}

function setup(env: Record<string, string> = {}) {
  const planetState = new FakePlanetState();
  new SimulationService(
    planetState as unknown as PlanetStateService,
    config(env),
  ).onModuleInit();
  return planetState;
}

/** Runs the registered step as mutate() would, up to now. */
async function simulate(
  planetState: FakePlanetState,
  planet: Planet,
  plants: Plant[],
  now: Date,
): Promise<{ facts: Fact[]; em: FakeEntityManager }> {
  const em = new FakeEntityManager(plants);
  const ctx: MutationContext = {
    em: em as unknown as EntityManager,
    planet,
    now,
    previousSimulatedAt: planet.lastSimulatedAt,
    facts: [],
    newlyUnlocked: [],
  };
  for (const step of planetState.steps) {
    await step(ctx);
  }
  return { facts: ctx.facts, em };
}

function at(ms: number): Date {
  return new Date(T0.getTime() + ms);
}

describe('SimulationService', () => {
  it('registers one simulation step and one snapshot contributor', () => {
    const planetState = setup();

    expect(planetState.steps).toHaveLength(1);
    expect(planetState.contributors).toHaveLength(1);
  });

  it('blooms a 2-hour sunflower over a 3-hour absence (TIM-01 AC1)', async () => {
    const clock = new FakeClock(T0);
    const planet = planetRow(clock.now());
    const sunflower = plantRow('p1', 'sunflower', 0.5, { lat: 10, lon: 20 });
    clock.advance(3 * HOUR);

    const { facts, em } = await simulate(
      setup(),
      planet,
      [sunflower],
      clock.now(),
    );

    expect(sunflower).toMatchObject({
      stage: 'bloom',
      growth: 1,
      harvestReady: true,
    });
    expect(sunflower.water).toBeCloseTo(0.32, 9);
    expect(em.saved).toEqual([[sunflower]]);
    expect(planet.lastSimulatedAt).toEqual(clock.now());
    expect(facts).toEqual([
      {
        type: 'plant-stage',
        occurredAt: at(40 * MINUTE),
        payload: { plantId: 'p1', type: 'sunflower', stage: 'sprout' },
      },
      {
        type: 'plant-stage',
        occurredAt: at(80 * MINUTE),
        payload: { plantId: 'p1', type: 'sunflower', stage: 'young' },
      },
      {
        type: 'plant-bloomed',
        occurredAt: at(120 * MINUTE),
        payload: { plantId: 'p1', type: 'sunflower', lat: 10, lon: 20 },
      },
    ]);
  });

  it('stops growth where the water ran out, 5 hours into a 10-hour absence (TIM-01 AC3)', async () => {
    // Off the 15-minute grid; a cactus loses 0.03 an hour, so 0.27 turns
    // thirsty (below 0.12) after exactly 5 hours, at half speed until then.
    const start = at(7 * MINUTE);
    const whole = plantRow('p1', 'cactus', 0.27);
    const firstPart = plantRow('p2', 'cactus', 0.27);

    await simulate(
      setup(),
      planetRow(start),
      [whole],
      at(7 * MINUTE + 10 * HOUR),
    );
    await simulate(
      setup(),
      planetRow(start),
      [firstPart],
      at(7 * MINUTE + 5 * HOUR),
    );

    expect(Math.abs(whole.growth - (300 * 0.5) / 180)).toBeLessThan(1e-9);
    expect(Math.abs(whole.growth - firstPart.growth)).toBeLessThan(1e-9);
    expect(whole.stage).toBe('young');
    expect(whole.water).toBe(0);
  });

  it('simulates only 7 days of a 30-day absence and sets lastSimulatedAt to now (TIM-02 AC2)', async () => {
    const planetState = setup();
    const capped = planetRow(T0);
    const week = planetRow(T0);
    const longAway = plantRow('p1', 'sunflower', 0.5);
    const weekAway = plantRow('p2', 'sunflower', 0.5);

    const { facts } = await simulate(
      planetState,
      capped,
      [longAway],
      at(30 * DAY),
    );
    await simulate(planetState, week, [weekAway], at(7 * DAY));

    expect(capped.lastSimulatedAt).toEqual(at(30 * DAY));
    expect({ ...longAway, id: 'p2' }).toEqual(weekAway);
    expect(longAway).toMatchObject({ stage: 'bloom', water: 0 });
    for (const fact of facts) {
      expect(fact.occurredAt.getTime()).toBeLessThanOrEqual(
        at(7 * DAY).getTime(),
      );
    }
  });

  it('caps at the maxAwayDays tunable', async () => {
    const planet = planetRow(T0);
    const sunflower = plantRow('p1', 'sunflower', 0.5);

    await simulate(
      setup({ GAME_MAX_AWAY_DAYS: String(1 / 24) }),
      planet,
      [sunflower],
      at(30 * DAY),
    );

    // One hour of a 2-hour sunflower.
    expect(sunflower.growth).toBeCloseTo(0.5, 9);
    expect(sunflower.stage).toBe('sprout');
    expect(planet.lastSimulatedAt).toEqual(at(30 * DAY));
  });

  it('grows the same in two 1-hour advances as in one 2-hour advance (live mode)', async () => {
    // Away time only after 3 hours, so both runs are live, under the real sun.
    const planetState = setup({ GAME_SYNC_INTERVAL_SECONDS: '3600' });
    const spot = { lat: 20, lon: 40 };
    const split = plantRow('p1', 'sunflower', 0.6, spot);
    const once = plantRow('p1', 'sunflower', 0.6, spot);
    // Off the grid, and split off the grid too.
    const start = 7 * MINUTE;
    const splitPlanet = planetRow(at(start));

    const first = await simulate(
      planetState,
      splitPlanet,
      [split],
      at(start + HOUR),
    );
    const second = await simulate(
      planetState,
      splitPlanet,
      [split],
      at(start + 2 * HOUR),
    );
    const whole = await simulate(
      planetState,
      planetRow(at(start)),
      [once],
      at(start + 2 * HOUR),
    );

    expect(split.stage).toBe(once.stage);
    expect(Math.abs(split.growth - once.growth)).toBeLessThan(1e-9);
    expect(Math.abs(split.water - once.water)).toBeLessThan(1e-9);
    expect([...first.facts, ...second.facts]).toEqual(whole.facts);
    // The night side slowed it: full speed would have bloomed it.
    expect(once.growth).toBeGreaterThan(0);
    expect(once.growth).toBeLessThan(1);
  });

  it('treats a gap of more than three sync intervals as away time (TIM-01 AC4)', async () => {
    const planetState = setup();
    // The sun stands over lon 45 in the middle of the first slice; this
    // sunflower is on the far side, too dark, so it grows at half speed live.
    const spot = { lat: 0, lon: -135 };
    const live = plantRow('p1', 'sunflower', 0.6, spot);
    const away = plantRow('p2', 'sunflower', 0.6, spot);

    await simulate(planetState, planetRow(T0), [live], at(30_000));
    await simulate(planetState, planetRow(T0), [away], at(31_000));

    expect(live.growth).toBeCloseTo((0.5 * 0.5) / 120, 12);
    expect(away.growth).toBeCloseTo(31 / 60 / 120, 12);
  });

  it('reports every stage reached inside the interval, in the order it happened', async () => {
    const start = at(7 * MINUTE);
    const now = at(7 * MINUTE + 3 * HOUR);
    const plants = [
      plantRow('p1', 'sunflower', 0.5),
      plantRow('p2', 'clover', 0.5),
      plantRow('p3', 'mushroom', 0.5),
    ];

    const { facts } = await simulate(setup(), planetRow(start), plants, now);
    const times = facts.map((fact) => fact.occurredAt.getTime());

    expect(facts.filter((f) => f.type === 'plant-bloomed')).toHaveLength(3);
    expect(facts.filter((f) => f.type === 'plant-stage')).toHaveLength(6);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.min(...times)).toBeGreaterThan(start.getTime());
    expect(Math.max(...times)).toBeLessThanOrEqual(now.getTime());
  });

  it.each([
    ['has not moved on', 0],
    ['was set back', -HOUR],
  ])('changes nothing when the clock %s', async (_, offset) => {
    const planet = planetRow(T0);
    const plant = plantRow('p1', 'sunflower', 0.5);

    const { facts, em } = await simulate(setup(), planet, [plant], at(offset));

    expect(planet.lastSimulatedAt).toEqual(T0);
    expect(plant).toEqual(plantRow('p1', 'sunflower', 0.5));
    expect(em.saved).toEqual([]);
    expect(facts).toEqual([]);
  });

  describe('harvest re-arm (GRD-08)', () => {
    it('gives a harvested bloom its seeds back harvestCooldownMinutes later (AC3)', async () => {
      const planetState = setup();
      const clock = new FakeClock(T0);
      const planet = planetRow(clock.now());
      const clover = harvestedRow('p1', clock.now());

      clock.advance(HOUR - 10_000);
      await simulate(planetState, planet, [clover], clock.now());
      expect(clover.harvestReady).toBe(false);

      // The last 10 seconds are a live heartbeat.
      clock.advance(10_000);
      const { em } = await simulate(planetState, planet, [clover], clock.now());
      expect(clover).toMatchObject({ stage: 'bloom', harvestReady: true });
      expect(em.saved).toEqual([[clover]]);
    });

    it('has the seeds ready on return when it was harvested before an absence', async () => {
      const clock = new FakeClock(T0);
      const planet = planetRow(clock.now());
      const clover = harvestedRow('p1', clock.now());
      clock.advance(3 * DAY);

      await simulate(setup(), planet, [clover], clock.now());

      expect(clover).toMatchObject({ stage: 'bloom', harvestReady: true });
    });

    it('waits the harvestCooldownMinutes tunable', async () => {
      const planetState = setup({ GAME_HARVEST_COOLDOWN_MINUTES: '30' });
      const early = harvestedRow('p1', T0);
      const due = harvestedRow('p2', T0);

      await simulate(planetState, planetRow(T0), [early], at(29 * MINUTE));
      await simulate(planetState, planetRow(T0), [due], at(30 * MINUTE));

      expect(early.harvestReady).toBe(false);
      expect(due.harvestReady).toBe(true);
    });

    it('leaves a bloom that was never harvested as it is', async () => {
      const clover = harvestedRow('p1', null);

      await simulate(setup(), planetRow(T0), [clover], at(2 * HOUR));

      expect(clover.harvestReady).toBe(false);
    });
  });

  describe('snapshot contributor', () => {
    async function contribute(
      planet: Planet,
      serverTime: Date,
      sun: PlanetSnapshotDto['sun'],
    ): Promise<object> {
      const [contributor] = setup().contributors;
      return contributor({
        em: {} as EntityManager,
        planet,
        snapshot: {
          serverTime: serverTime.toISOString(),
          sun,
        } as PlanetSnapshotDto,
      });
    }

    it('adds where the sun is at serverTime', async () => {
      const sun = { overrideAngle: null, overrideAt: null };

      expect(await contribute(planetRow(T0), at(15 * MINUTE), sun)).toEqual({
        sun: { ...sun, angle: 90 },
      });
    });

    it('holds a dragged sun for sunOverrideMinutes (GRD-03 AC2)', async () => {
      const planet = planetRow(T0);
      planet.sunOverrideAngle = 300;
      planet.sunOverrideAt = at(14 * MINUTE);
      const sun = {
        overrideAngle: 300,
        overrideAt: at(14 * MINUTE).toISOString(),
      };

      expect(await contribute(planet, at(15 * MINUTE), sun)).toEqual({
        sun: { ...sun, angle: 300 },
      });
      // Five minutes of hold, then 15 minutes of drift: a quarter turn.
      expect(await contribute(planet, at(34 * MINUTE), sun)).toEqual({
        sun: { ...sun, angle: 30 },
      });
    });
  });
});
