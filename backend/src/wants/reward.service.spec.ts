import type { EntityManager } from 'typeorm';
import { FakeClock } from '../../test/support/fake-clock';
import { SeededRandom } from '../../test/support/seeded-random';
import type { GameConfigService } from '../game-config/game-config.service';
import type {
  GrantItem,
  InventoryService,
} from '../inventory/inventory.service';
import type { MutationContext } from '../planets/planet-state/mutation.types';
import type { Planet } from '../planets/planet.entity';
import { RewardService } from './reward.service';

const PLANET_ID = 'planet-1';
const STARTERS = ['clover', 'sunflower', 'mushroom'];

/** A planet's unlocks and stacks, granted to as InventoryService does. */
function setup(unlocked: string[] = STARTERS, seed = 1) {
  const unlocks = new Set(unlocked);
  const stacks = new Map<string, number>();
  const inventory = {
    grant: (
      _em: EntityManager,
      _planetId: string,
      items: readonly GrantItem[],
    ) => {
      const newlyUnlocked: string[] = [];
      for (const { itemType, count } of items) {
        stacks.set(itemType, (stacks.get(itemType) ?? 0) + count);
        if (!unlocks.has(itemType)) {
          unlocks.add(itemType);
          newlyUnlocked.push(itemType);
        }
      }
      return Promise.resolve({ newlyUnlocked });
    },
  };
  const em = {
    find: () => Promise.resolve([...unlocks].map((itemType) => ({ itemType }))),
  } as unknown as EntityManager;
  const service = new RewardService(
    inventory as unknown as InventoryService,
    { unlockEveryNRewards: 3 } as GameConfigService,
    new SeededRandom(seed),
  );
  const planet = { id: PLANET_ID, rewardCounter: 0 } as Planet;
  const clock = new FakeClock();
  const ctx = (): MutationContext => ({
    em,
    planet,
    now: clock.now(),
    previousSimulatedAt: clock.now(),
    facts: [],
    newlyUnlocked: [],
  });
  return { service, planet, stacks, ctx };
}

describe('RewardService', () => {
  it('unlocks at least 3 new items in 9 rewards while enough are locked (WNT-04 AC2)', async () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { service, ctx } = setup(STARTERS, seed);
      const unlockedNow: string[] = [];
      for (let i = 0; i < 9; i++) {
        const each = ctx();
        await service.rewardFor(each);
        unlockedNow.push(...each.newlyUnlocked);
      }

      expect(unlockedNow.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('unlocks something new on every third reward (ITM-04 AC2)', async () => {
    const { service, ctx, planet } = setup();
    const unlockedBy: number[] = [];
    for (let i = 0; i < 6; i++) {
      const each = ctx();
      await service.rewardFor(each);
      unlockedBy.push(each.newlyUnlocked.length);
    }

    expect(planet.rewardCounter).toBe(6);
    expect(unlockedBy[2]).toBe(1);
    expect(unlockedBy[5]).toBe(1);
    expect(unlockedBy[0] + unlockedBy[1] + unlockedBy[3] + unlockedBy[4]).toBe(
      0,
    );
  });

  it('grants the reward it returns: 1 or 2 item types (WNT-04 AC1)', async () => {
    const { service, ctx, stacks } = setup();

    const reward = await service.rewardFor(ctx());

    expect(reward.length).toBeGreaterThanOrEqual(1);
    expect(reward.length).toBeLessThanOrEqual(2);
    for (const { itemType, count } of reward) {
      expect(stacks.get(itemType)).toBe(count);
    }
  });

  it('gives owned types once nothing is locked', async () => {
    const everything = [
      ...STARTERS,
      'tulip',
      'bluebell',
      'moonflower',
      'fern',
      'cactus',
      'pond',
      'rock',
      'lamp-post',
      'bench',
      'tiny-house',
    ];
    const { service, ctx } = setup(everything);
    for (let i = 0; i < 6; i++) {
      const each = ctx();
      const reward = await service.rewardFor(each);
      expect(each.newlyUnlocked).toEqual([]);
      expect(reward.every((item) => everything.includes(item.itemType))).toBe(
        true,
      );
    }
  });

  it('gifts one unlocked item without counting it as a reward (CRT-04 AC2)', async () => {
    const { service, ctx, planet, stacks } = setup();
    const each = ctx();

    const gift = await service.giftFor(each);

    expect(STARTERS).toContain(gift.itemType);
    expect(stacks.get(gift.itemType)).toBe(gift.count);
    expect(planet.rewardCounter).toBe(0);
    expect(each.newlyUnlocked).toEqual([]);
  });
});
