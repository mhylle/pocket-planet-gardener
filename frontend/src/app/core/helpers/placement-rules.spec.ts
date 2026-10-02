import table from './placement-rules.fixtures.json';
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

// The backend spec checks that this table and the helper match its copies.
// JSON imports type kind and expect as plain strings, hence the cast.
const fixtures = table as Fixtures;

describe('placement rules', () => {
  it.each(fixtures.cases)('$name: $expect', ({ state, candidate, expect: want }) => {
    expect(canPlaceAt(fixtures.states[state], candidate)).toBe(want);
  });

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
    const full = fixtures.states['full'];
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
