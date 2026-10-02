import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DECORATIONS } from '../content/decorations';
import { PLANTS } from '../content/plants';
import {
  DECORATION_IDS,
  PLANT_IDS,
  dependsOn,
  describe as describeWant,
  evaluate,
  isAchievable,
  plural,
  type Home,
  type WantCapacity,
  type WantItem,
  type WantNames,
  type WantSpec,
  type WantWorld,
} from './want-evaluator';

interface EvaluateCase {
  name: string;
  world: string;
  spec: WantSpec;
  expect: boolean;
}

/** capacity overrides the shared one field by field. */
interface AchievableCase {
  name: string;
  spec: WantSpec;
  capacity?: Partial<CapacityFixture>;
  expect: boolean;
}

interface DescribeCase {
  spec: WantSpec;
  expect: string;
}

/** Checked on the garden world. */
interface DependsOnCase {
  name: string;
  spec: WantSpec;
  plant: WantItem;
  expect: boolean;
}

/** WantCapacity with the unlocked set as a list. */
interface CapacityFixture {
  unlocked: string[];
  maxPlants: number;
  plantCount: number;
}

interface Fixtures {
  home: Home;
  worlds: Record<string, WantWorld>;
  evaluate: EvaluateCase[];
  capacity: CapacityFixture;
  achievable: AchievableCase[];
  names: {
    plants: Record<string, string>;
    decorations: Record<string, string>;
    creatureName: string;
  };
  describe: DescribeCase[];
  dependsOn: DependsOnCase[];
}

// Jest runs from backend/, so both paths start there.
const BACKEND_DIR = join('src', 'wants');
const FRONTEND_DIR = join('..', 'frontend', 'src', 'app', 'core', 'helpers');

/** Reads a file with LF line endings, whatever git checked it out with. */
function read(dir: string, file: string): string {
  return readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
}

const fixtures = JSON.parse(
  read(BACKEND_DIR, 'want-evaluator.fixtures.json'),
) as Fixtures;

function capacityFor(overrides: Partial<CapacityFixture> = {}): WantCapacity {
  const { unlocked, ...rest } = { ...fixtures.capacity, ...overrides };
  return { ...rest, unlocked: new Set(unlocked) };
}

const names: WantNames = {
  plant: (id) => fixtures.names.plants[id],
  decoration: (id) => fixtures.names.decorations[id],
  creatureName: fixtures.names.creatureName,
};

describe('want evaluator', () => {
  describe('evaluate (WNT-02 AC3)', () => {
    it.each(fixtures.evaluate)(
      '$name: $expect',
      ({ world, spec, expect: want }) => {
        const met = evaluate(spec, fixtures.worlds[world], fixtures.home);

        expect(met).toBe(want);
      },
    );

    it('has a met and an unmet case for every want type', () => {
      const seen = new Set(
        fixtures.evaluate.map((c) => `${c.spec.type} ${c.expect}`),
      );

      expect(seen.size).toBe(10);
    });
  });

  describe('isAchievable (WNT-02 AC1, AC4)', () => {
    it.each(fixtures.achievable)(
      '$name: $expect',
      ({ spec, capacity, expect: want }) => {
        expect(isAchievable(spec, capacityFor(capacity))).toBe(want);
      },
    );
  });

  describe('describe (WNT-02 AC2)', () => {
    it.each(fixtures.describe)('$expect', ({ spec, expect: want }) => {
      expect(describeWant(spec, names)).toBe(want);
    });
  });

  describe('dependsOn (GRD-07 AC3)', () => {
    it.each(fixtures.dependsOn)(
      '$name: $expect',
      ({ spec, plant, expect: want }) => {
        const garden = fixtures.worlds['garden'];

        expect(dependsOn(spec, plant, garden, fixtures.home)).toBe(want);
      },
    );
  });

  describe('plural', () => {
    it.each([
      ['clover', 1, 'clover'],
      ['clover', 2, 'clovers'],
      ['moth', 3, 'moths'],
      ['bluebell', 2, 'bluebells'],
      ['cactus', 2, 'cacti'],
      ['cactus', 1, 'cactus'],
    ])('%s for %d is %s', (noun, count, want) => {
      expect(plural(noun, count)).toBe(want);
    });
  });

  it('knows every plant and decoration in the catalogue, and no others', () => {
    expect([...PLANT_IDS].sort()).toEqual(PLANTS.map((p) => p.id).sort());
    expect([...DECORATION_IDS].sort()).toEqual(
      DECORATIONS.map((d) => d.id).sort(),
    );
  });
});

describe('frontend copy (plan D-10)', () => {
  it.each(['want-evaluator.ts', 'want-evaluator.fixtures.json'])(
    '%s is identical to the backend copy',
    (file) => {
      expect(read(FRONTEND_DIR, file)).toBe(read(BACKEND_DIR, file));
    },
  );
});
