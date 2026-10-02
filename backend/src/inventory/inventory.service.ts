import { BadRequestException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { DecorationId, PlantId } from '../content/content.types';
import { InventoryItem, type ItemKind } from './inventory-item.entity';
import { Unlock } from './unlock.entity';

const NOT_OWNED = "You don't have any of those right now.";

/** Some of one item type, to add to a planet's inventory. */
export interface GrantItem {
  itemType: PlantId | DecorationId;
  kind: ItemKind;
  count: number;
}

/**
 * A planet's seeds and decorations, and the types it has unlocked (ITM-01,
 * ITM-04). Every method runs inside the caller's transaction, usually a
 * mutate() command, through the EntityManager it is given.
 */
@Injectable()
export class InventoryService {
  /**
   * Adds the items to the planet's stacks. A type the planet has never had
   * is unlocked and returned, once (ITM-04 AC3).
   */
  async grant(
    em: EntityManager,
    planetId: string,
    items: readonly GrantItem[],
    now: Date,
  ): Promise<{ newlyUnlocked: string[] }> {
    const newlyUnlocked: string[] = [];
    for (const { itemType, kind, count } of items) {
      const stack = await em.findOneBy(InventoryItem, { planetId, itemType });
      if (stack) {
        await em.update(
          InventoryItem,
          { id: stack.id },
          { count: stack.count + count },
        );
      } else {
        await em.insert(InventoryItem, { planetId, itemType, kind, count });
      }
      if (!(await em.existsBy(Unlock, { planetId, itemType }))) {
        await em.insert(Unlock, { planetId, itemType, unlockedAt: now });
        newlyUnlocked.push(itemType);
      }
    }
    return { newlyUnlocked };
  }

  /**
   * Takes n of a type, or refuses with a 400 when the planet holds fewer.
   * A stack that runs out is removed (ITM-01 AC2).
   */
  async consume(
    em: EntityManager,
    planetId: string,
    itemType: PlantId | DecorationId,
    n = 1,
  ): Promise<void> {
    const stack = await em.findOneBy(InventoryItem, { planetId, itemType });
    if (!stack || stack.count < n) {
      throw new BadRequestException({
        statusCode: 400,
        message: NOT_OWNED,
        reason: 'not-owned',
      });
    }
    if (stack.count === n) {
      await em.delete(InventoryItem, { id: stack.id });
    } else {
      await em.update(
        InventoryItem,
        { id: stack.id },
        { count: stack.count - n },
      );
    }
  }

  /** The planet's stacks, by item type. */
  list(em: EntityManager, planetId: string): Promise<InventoryItem[]> {
    return em.find(InventoryItem, {
      where: { planetId },
      order: { itemType: 'ASC' },
    });
  }
}
