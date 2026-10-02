import type { DecorationId, PlantId } from '../content/content.types';
import { DECORATIONS } from '../content/decorations';
import { PLANTS } from '../content/plants';
import type { ItemKind } from '../inventory/inventory-item.entity';
import type { GrantItem } from '../inventory/inventory.service';

// What a reward or a gift holds (WNT-04, ITM-04 AC2, CRT-04 AC2).

/** The draws a reward is made with, as RandomService makes them. */
export interface RewardDraws {
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export interface RewardChoice {
  // Item types the planet has unlocked.
  unlocked: ReadonlySet<string>;
  // Whether this one should hold an item the planet has never had.
  unlockNew: boolean;
  // How many different item types it holds.
  size: number;
}

interface CatalogueItem {
  itemType: PlantId | DecorationId;
  kind: ItemKind;
}

/** Every item a reward can hold: each plant's seeds and each decoration. */
const CATALOGUE: readonly CatalogueItem[] = [
  ...PLANTS.map((plant) => ({ itemType: plant.id, kind: 'seed' as const })),
  ...DECORATIONS.map((decoration) => ({
    itemType: decoration.id,
    kind: 'decoration' as const,
  })),
];

/** One in this many ordinary picks is a decoration, when one is unlocked. */
const DECORATION_ONE_IN = 5;

/** Seeds come by the small handful; a decoration comes alone. */
const SEEDS = { min: 2, max: 3 };

/**
 * The items of a reward: size different types. With unlockNew it starts
 * with an item the planet has never had, while any is left (WNT-04 AC2);
 * the rest are seeds of unlocked plants, now and then an unlocked
 * decoration. Never empty (WNT-04 AC1).
 */
export function chooseReward(
  choice: RewardChoice,
  random: RewardDraws,
): GrantItem[] {
  const locked = CATALOGUE.filter(
    (item) => !choice.unlocked.has(item.itemType),
  );
  const chosen: CatalogueItem[] = [];
  if (choice.unlockNew && locked.length > 0) {
    chosen.push(random.pick(locked));
  }
  while (chosen.length < choice.size) {
    const left = CATALOGUE.filter(
      (item) => choice.unlocked.has(item.itemType) && !chosen.includes(item),
    );
    const seeds = left.filter((item) => item.kind === 'seed');
    const decorations = left.filter((item) => item.kind === 'decoration');
    const pool =
      decorations.length > 0 &&
      (seeds.length === 0 || random.int(1, DECORATION_ONE_IN) === 1)
        ? decorations
        : seeds;
    if (pool.length === 0) {
      break;
    }
    chosen.push(random.pick(pool));
  }
  // Only a planet with nothing unlocked gets here empty-handed.
  if (chosen.length === 0) {
    chosen.push(random.pick(locked));
  }
  return chosen.map((item) => ({
    ...item,
    count: item.kind === 'seed' ? random.int(SEEDS.min, SEEDS.max) : 1,
  }));
}
