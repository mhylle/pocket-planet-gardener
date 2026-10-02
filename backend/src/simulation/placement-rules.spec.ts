import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PLANT_FOOTPRINT_STEPS,
  canPlaceAt,
  isPlanetFull,
  type PlacementCandidate,
  type PlacementReason,
  type PlacementState,
} from './placement-rules';

/** A candidate placed on one of the named states, and the answer. */
interface PlacementCase {
  name: string;
  state: string;
  candidate: PlacementCandidate;
  expect: PlacementReason;
}

interface Fixtures {
  states: Record<string, PlacementState>;
  cases: PlacementCase[];
}

// Jest runs from backend/, so both paths start there.
const BACKEND_DIR = join('src', 'simulation');
const FRONTEND_DIR = join('..', 'frontend', 'src', 'app', 'core', 'helpers');

/** Reads a file with LF line endings, whatever git checked it out with. */
function read(dir: string, file: string): string {
  return readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
}

const fixtures = JSON.parse(
  read(BACKEND_DIR, 'placement-rules.fixtures.json'),
) as Fixtures;

describe('placement rules', () => {
  it.each(fixtures.cases)(
    '$name: $expect',
    ({ state, candidate, expect: want }) => {
      expect(canPlaceAt(fixtures.states[state], candidate)).toBe(want);
    },
  );

  it('covers every reason (Task 5.1)', () => {
    const reasons = new Set(fixtures.cases.map((c) => c.expect));

    expect([...reasons].sort()).toEqual([
      'occupied-decoration',
      'occupied-plant',
      'occupied-water',
      'ok',
      'planet-full',
    ]);
  });

  it('is full at maxPlants plants and not one before', () => {
    const full = fixtures.states.full;
    const almost = { ...full, maxPlants: full.plants.length + 1 };

    expect(isPlanetFull(full)).toBe(true);
    expect(isPlanetFull(almost)).toBe(false);
    expect(
      canPlaceAt(almost, {
        kind: 'plant',
        point: { lat: 45, lon: 45 },
        footprintSteps: PLANT_FOOTPRINT_STEPS,
      }),
    ).toBe('ok');
  });
});

describe('frontend copy (plan D-10)', () => {
  it.each(['placement-rules.ts', 'placement-rules.fixtures.json'])(
    '%s is identical to the backend copy',
    (file) => {
      expect(read(FRONTEND_DIR, file)).toBe(read(BACKEND_DIR, file));
    },
  );
});
