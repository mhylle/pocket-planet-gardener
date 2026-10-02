import { Injectable } from '@nestjs/common';
import { RandomService } from '../common/random.service';
import { GameConfigService } from '../game-config/game-config.service';
import {
  InventoryService,
  type GrantItem,
} from '../inventory/inventory.service';
import { Unlock } from '../inventory/unlock.entity';
import type { MutationContext } from '../planets/planet-state/mutation.types';
import { chooseReward, type RewardChoice } from './reward-rules';

/**
 * Rewards for fulfilled wants and the gifts of overjoyed creatures (WNT-04,
 * ITM-04 AC2, CRT-04 AC2). Each is granted straight into the inventory in
 * the mutation's transaction; a type the planet has never had goes into
 * ctx.newlyUnlocked to be celebrated (ITM-04 AC3).
 */
@Injectable()
export class RewardService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly config: GameConfigService,
    private readonly random: RandomService,
  ) {}

  /**
   * A fulfilled want's reward: one or two item types. The planet counts its
   * rewards, and every unlockEveryNRewards-th holds something new while
   * anything is still locked (WNT-04 AC2).
   */
  rewardFor(ctx: MutationContext): Promise<GrantItem[]> {
    const number = ++ctx.planet.rewardCounter;
    return this.give(ctx, {
      unlockNew: number % this.config.unlockEveryNRewards === 0,
      size: this.random.int(1, 2),
    });
  }

  /**
   * An overjoyed creature's gift: seeds or a decoration the planet has
   * unlocked. Not counted as a reward, so a gift never takes a want's turn
   * to unlock something.
   */
  async giftFor(ctx: MutationContext): Promise<GrantItem> {
    const [item] = await this.give(ctx, { unlockNew: false, size: 1 });
    return item;
  }

  private async give(
    ctx: MutationContext,
    choice: Omit<RewardChoice, 'unlocked'>,
  ): Promise<GrantItem[]> {
    const { em, planet, now } = ctx;
    const unlocks = await em.find(Unlock, { where: { planetId: planet.id } });
    const items = chooseReward(
      { ...choice, unlocked: new Set(unlocks.map((each) => each.itemType)) },
      this.random,
    );
    const { newlyUnlocked } = await this.inventory.grant(
      em,
      planet.id,
      items,
      now,
    );
    ctx.newlyUnlocked.push(...newlyUnlocked);
    return items;
  }
}
