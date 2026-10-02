import { SeededRandom } from '../../test/support/seeded-random';
import { DECORATIONS } from '../content/decorations';
import { PLANTS } from '../content/plants';
import { chooseReward } from './reward-rules';

const STARTERS = new Set(['clover', 'sunflower', 'mushroom']);
const EVERYTHING = new Set([
  ...PLANTS.map((plant) => plant.id),
  ...DECORATIONS.map((decoration) => decoration.id),
]);

describe('chooseReward', () => {
  it('starts with an item the planet has never had when it should unlock (WNT-04 AC2)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const items = chooseReward(
        { unlocked: STARTERS, unlockNew: true, size: 2 },
        new SeededRandom(seed),
      );

      expect(STARTERS.has(items[0].itemType)).toBe(false);
      expect(items.slice(1).every((item) => STARTERS.has(item.itemType))).toBe(
        true,
      );
    }
  });

  it('otherwise holds only unlocked items, mostly seeds', () => {
    const unlocked = new Set([...STARTERS, 'bench']);
    const kinds: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const items = chooseReward(
        { unlocked, unlockNew: false, size: 2 },
        new SeededRandom(seed),
      );
      expect(items.every((item) => unlocked.has(item.itemType))).toBe(true);
      kinds.push(...items.map((item) => item.kind));
    }

    const decorations = kinds.filter((kind) => kind === 'decoration').length;
    expect(decorations).toBeGreaterThan(0);
    expect(decorations).toBeLessThan(kinds.length / 3);
  });

  it('holds owned types when nothing is locked any more', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const items = chooseReward(
        { unlocked: EVERYTHING, unlockNew: true, size: 2 },
        new SeededRandom(seed),
      );
      expect(items.every((item) => EVERYTHING.has(item.itemType))).toBe(true);
    }
  });

  it('holds size different types: seeds by 2 or 3, a decoration alone', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const items = chooseReward(
        { unlocked: EVERYTHING, unlockNew: false, size: 2 },
        new SeededRandom(seed),
      );

      expect(items).toHaveLength(2);
      expect(items[0].itemType).not.toBe(items[1].itemType);
      for (const item of items) {
        if (item.kind === 'seed') {
          expect([2, 3]).toContain(item.count);
        } else {
          expect(item.count).toBe(1);
        }
      }
    }
  });

  it('is never empty, even for a planet with nothing unlocked (WNT-04 AC1)', () => {
    const items = chooseReward(
      { unlocked: new Set(), unlockNew: false, size: 1 },
      new SeededRandom(),
    );

    expect(items).toHaveLength(1);
  });
});
