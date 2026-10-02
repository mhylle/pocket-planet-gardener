import { WantSpec, WantType } from '../helpers/want-evaluator';
import { Species } from './creature';
import { InventoryItemDto } from './planet-snapshot';

/** A creature's active want, as the snapshot names it (WNT-01, WNT-02). */
export interface WantDto {
  id: string;
  type: WantType;
  /** The want in the creature's own voice (WNT-01 AC3). */
  text: string;
  /** What is needed in plain words, such as "2 moonflowers within 3 steps of the lamp-post". */
  plainDescription: string;
  spec: WantSpec;
}

/** Items a creature hands over, as a reward or a gift (WNT-04, CRT-04 AC2). */
export type RewardItem = InventoryItemDto;

/** The payload of a 'want-fulfilled' event (WNT-03, WNT-04). */
export interface WantFulfilledPayload {
  creatureId: string;
  name: string;
  species: Species;
  lat: number;
  lon: number;
  wantText: string;
  thankYou: string;
  reward: RewardItem[];
}

/** The payload of a 'gift-received' event: an overjoyed creature's present (CRT-04 AC2). */
export interface GiftReceivedPayload {
  creatureId: string;
  name: string;
  species: Species;
  lat: number;
  lon: number;
  item: RewardItem;
}
