import table from './want-evaluator.fixtures.json';
import {
  dependsOn,
  describe as describeWant,
  evaluate,
  isAchievable,
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

// The backend spec checks that this table and the helper match its copies.
// Some achievable cases are malformed on purpose, hence the cast via unknown.
const fixtures = table as unknown as Fixtures;

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
  it.each(fixtures.evaluate)('evaluate, $name: $expect', ({ world, spec, expect: want }) => {
    expect(evaluate(spec, fixtures.worlds[world], fixtures.home)).toBe(want);
  });

  it.each(fixtures.achievable)(
    'isAchievable, $name: $expect',
    ({ spec, capacity, expect: want }) => {
      expect(isAchievable(spec, capacityFor(capacity))).toBe(want);
    },
  );

  it.each(fixtures.describe)('describe: $expect', ({ spec, expect: want }) => {
    expect(describeWant(spec, names)).toBe(want);
  });

  it.each(fixtures.dependsOn)('dependsOn, $name: $expect', ({ spec, plant, expect: want }) => {
    expect(dependsOn(spec, plant, fixtures.worlds['garden'], fixtures.home)).toBe(want);
  });
});
