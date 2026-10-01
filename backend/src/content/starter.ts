import type { StarterItem } from './content.types';

/**
 * Seeds every new planet starts with, and no decorations (ITM-04 AC1). Clover
 * is the tutorial seed; four of them leave three for the snail's condition.
 * The three light preferences make moving the sun matter from the start.
 */
export const STARTER_INVENTORY: readonly StarterItem[] = [
  { itemType: 'clover', count: 4 },
  { itemType: 'sunflower', count: 2 },
  { itemType: 'mushroom', count: 2 },
];
