import { SeededRandom } from '../../test/support/seeded-random';
import { RandomService } from './random.service';

/** Draws int(min, max) many times and returns the distinct values seen. */
function draws(random: RandomService, min: number, max: number): Set<number> {
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) {
    seen.add(random.int(min, max));
  }
  return seen;
}

describe.each([
  ['RandomService', () => new RandomService()],
  ['SeededRandom', () => new SeededRandom(42)],
])('%s', (_name, build) => {
  it('draws integers within the bounds, reaching both ends', () => {
    expect([...draws(build(), -2, 3)].sort((a, b) => a - b)).toEqual([
      -2, -1, 0, 1, 2, 3,
    ]);
  });

  it('returns the only value when min equals max', () => {
    expect(draws(build(), 7, 7)).toEqual(new Set([7]));
  });

  it('picks an element of the list', () => {
    const items = ['moss', 'fern', 'cactus'] as const;
    const random = build();

    for (let i = 0; i < 100; i++) {
      expect(items).toContain(random.pick(items));
    }
  });

  it('refuses to pick from an empty list', () => {
    expect(() => build().pick([])).toThrow('Cannot pick from an empty list');
  });
});

describe('SeededRandom', () => {
  const sequence = (seed: number): number[] => {
    const random = new SeededRandom(seed);
    return Array.from({ length: 20 }, () => random.int(0, 1000));
  };

  it('repeats the same draws for the same seed', () => {
    expect(sequence(7)).toEqual(sequence(7));
  });

  it('draws differently for a different seed', () => {
    expect(sequence(7)).not.toEqual(sequence(8));
  });
});
