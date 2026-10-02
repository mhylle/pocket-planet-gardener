import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STAGES,
  advancePlant,
  growthMultiplier,
  lightStatus,
  stageFor,
  waterDecayPerHour,
  waterStatus,
  type Exposure,
  type GrowthState,
  type GrowthTunables,
  type LightPref,
  type LightStatus,
  type PlantNeeds,
  type ReachedStage,
  type Stage,
  type WaterPref,
  type WaterStatus,
} from './growth-rules';

/** A plant from the named table, grown from a state, and where it ends. */
interface AdvanceCase {
  name: string;
  plant: string;
  state: GrowthState;
  minutes: number;
  exposure: Exposure;
  expect: { state: GrowthState; reachedStages: ReachedStage[] };
}

interface Fixtures {
  tunables: GrowthTunables;
  waterStatus: { water: number; expect: WaterStatus }[];
  lightStatus: { pref: LightPref; exposure: Exposure; expect: LightStatus }[];
  growthMultiplier: {
    water: WaterStatus;
    light: LightStatus;
    expect: number;
  }[];
  waterDecayPerHour: { pref: WaterPref; expect: number }[];
  stageFor: { growth: number; expect: Stage }[];
  plants: Record<string, PlantNeeds>;
  advance: AdvanceCase[];
}

// Jest runs from backend/, so both paths start there.
const BACKEND_DIR = join('src', 'simulation');
const FRONTEND_DIR = join('..', 'frontend', 'src', 'app', 'core', 'helpers');

/** Reads a file with LF line endings, whatever git checked it out with. */
function read(dir: string, file: string): string {
  return readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
}

const fixtures = JSON.parse(
  read(BACKEND_DIR, 'growth-rules.fixtures.json'),
) as Fixtures;
const { tunables } = fixtures;

/** Digits: results agree to 1e-9 (Task 6.2). */
const EXACT = 9;

function expectState(actual: GrowthState, want: GrowthState): void {
  expect(actual.stage).toBe(want.stage);
  expect(actual.growth).toBeCloseTo(want.growth, EXACT);
  expect(actual.water).toBeCloseTo(want.water, EXACT);
  expect(actual.harvestReady).toBe(want.harvestReady);
}

function seed(water: number): GrowthState {
  return { stage: 'seed', growth: 0, water, harvestReady: false };
}

describe('growth rules', () => {
  it.each(fixtures.waterStatus)('water $water is $expect', (c) => {
    expect(waterStatus(c.water)).toBe(c.expect);
  });

  it.each(fixtures.lightStatus)('$pref in $exposure is $expect', (c) => {
    expect(lightStatus(c.pref, c.exposure)).toBe(c.expect);
  });

  it.each(fixtures.growthMultiplier)(
    '$water and $light grow at $expect',
    (c) => {
      expect(growthMultiplier(c.water, c.light, tunables)).toBe(c.expect);
    },
  );

  it.each(fixtures.waterDecayPerHour)('$pref loses $expect an hour', (c) => {
    expect(waterDecayPerHour(c.pref)).toBe(c.expect);
  });

  it.each(fixtures.stageFor)('growth $growth is $expect', (c) => {
    expect(stageFor(c.growth)).toBe(c.expect);
  });

  describe.each(fixtures.advance)('$name', (c) => {
    const result = advancePlant(
      c.state,
      fixtures.plants[c.plant],
      c.minutes,
      c.exposure,
      tunables,
    );

    it('ends in the expected state', () => {
      expectState(result.state, c.expect.state);
    });

    it('reaches the expected stages at the expected minutes', () => {
      const want = c.expect.reachedStages;

      expect(result.reachedStages.map((r) => r.stage)).toEqual(
        want.map((r) => r.stage),
      );
      result.reachedStages.forEach((reached, i) => {
        expect(reached.atMinute).toBeCloseTo(want[i].atMinute, EXACT);
      });
    });
  });

  it('stops growing exactly where the water ran out (TIM-01 AC3)', () => {
    const needs = fixtures.plants['sun-600'];
    const whole = advancePlant(seed(0.42), needs, 600, 'away', tunables);
    const firstPart = advancePlant(seed(0.42), needs, 300, 'away', tunables);
    const justAfter = advancePlant(seed(0.42), needs, 301, 'away', tunables);

    expect(firstPart.state.growth).toBeGreaterThan(0);
    expect(Math.abs(whole.state.growth - firstPart.state.growth)).toBeLessThan(
      1e-9,
    );
    expect(waterStatus(justAfter.state.water)).toBe('thirsty');
  });

  it('grows the same in 15-minute slices as in one go', () => {
    const needs = fixtures.plants['sun-240'];
    const whole = advancePlant(seed(0.97), needs, 600, 'away', tunables);
    let state = seed(0.97);
    const reached: ReachedStage[] = [];
    for (let slice = 0; slice < 40; slice++) {
      const step = advancePlant(state, needs, 15, 'away', tunables);
      state = step.state;
      reached.push(
        ...step.reachedStages.map((r) => ({
          stage: r.stage,
          atMinute: slice * 15 + r.atMinute,
        })),
      );
    }

    expectState(state, whole.state);
    expect(reached.map((r) => r.stage)).toEqual(
      whole.reachedStages.map((r) => r.stage),
    );
    reached.forEach((r, i) => {
      expect(r.atMinute).toBeCloseTo(whole.reachedStages[i].atMinute, EXACT);
    });
  });

  it.each([
    ['with rain every 6 hours', 24],
    ['with no rain at all', 0],
  ])(
    'never lowers a stage over 30 simulated days, %s (GRD-05 AC3, GRD-06)',
    (_, rainEvery) => {
      const needs = fixtures.plants.sunflower;
      const exposures: Exposure[] = [1, 0, 0.5, 'away'];
      let state = seed(0.5);
      for (let slice = 0; slice < 30 * 96; slice++) {
        // A quarter-hour slice; rain tops the water up to soggy.
        if (rainEvery > 0 && slice % rainEvery === 0) {
          state = { ...state, water: 0.95 };
        }
        const exposure = exposures[Math.floor(slice / 4) % exposures.length];
        const next = advancePlant(state, needs, 15, exposure, tunables).state;

        expect(STAGES.indexOf(next.stage)).toBeGreaterThanOrEqual(
          STAGES.indexOf(state.stage),
        );
        expect(next.growth).toBeGreaterThanOrEqual(state.growth);
        expect(next.water).toBeGreaterThanOrEqual(0);
        state = next;
      }

      expect(state.stage).toBe('bloom');
      expect(state.harvestReady).toBe(true);
      if (rainEvery === 0) {
        expect(waterStatus(state.water)).toBe('thirsty');
      }
    },
  );

  it('leaves the state it is given untouched', () => {
    const start = seed(0.5);

    advancePlant(start, fixtures.plants.sunflower, 180, 'away', tunables);

    expect(start).toEqual(seed(0.5));
  });

  it('covers every water and light status', () => {
    const water = new Set(fixtures.waterStatus.map((c) => c.expect));
    const light = new Set(fixtures.lightStatus.map((c) => c.expect));

    expect([...water].sort()).toEqual([
      'a-bit-thirsty',
      'happy',
      'soggy',
      'thirsty',
    ]);
    expect([...light].sort()).toEqual(['ok', 'too-dark', 'too-sunny']);
  });
});

describe('frontend copy (plan D-10)', () => {
  it.each(['growth-rules.ts', 'growth-rules.fixtures.json'])(
    '%s is identical to the backend copy',
    (file) => {
      expect(read(FRONTEND_DIR, file)).toBe(read(BACKEND_DIR, file));
    },
  );
});
