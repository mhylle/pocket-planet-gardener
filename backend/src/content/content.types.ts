/** How much rain a plant type likes (GRD-04). */
export type WaterPref = 'low' | 'medium' | 'high';

/** How much sunlight a plant type likes (GRD-04). */
export type LightPref = 'shade' | 'partial' | 'full-sun';

export type PlantId =
  | 'clover'
  | 'sunflower'
  | 'tulip'
  | 'bluebell'
  | 'moonflower'
  | 'mushroom'
  | 'fern'
  | 'cactus';

export type DecorationId =
  'pond' | 'rock' | 'lamp-post' | 'bench' | 'tiny-house';

export type SpeciesId = 'worm' | 'snail' | 'bee' | 'moth' | 'hedgehog' | 'frog';

export interface PlantType {
  id: PlantId;
  name: string;
  waterPref: WaterPref;
  lightPref: LightPref;
  /** Minutes from seed to bloom while every need is met (GRD-05 AC2). */
  bloomMinutes: number;
  /** Short, funny catalogue text, at most 2 sentences (ITM-03 AC2). */
  description: string;
  /** Shown on the catalogue silhouette before the plant is unlocked (ITM-03 AC1). */
  unlockHint: string;
}

export interface DecorationType {
  id: DecorationId;
  name: string;
  /** How many surface steps across the decoration is when placed. */
  footprintSteps: number;
  /** Water, such as the pond: nothing can be planted in it (GRD-01 AC3). */
  isWater: boolean;
  /** Short, funny catalogue text, at most 2 sentences (ITM-03 AC2). */
  description: string;
  /** Shown on the catalogue silhouette before it is unlocked (ITM-03 AC1). */
  unlockHint: string;
}

/** The planet state a species needs before one of its creatures moves in (CRT-01). */
export type ArrivalCondition =
  | { kind: 'first-bloom' }
  | { kind: 'blooming'; plant: PlantId; count: number }
  | { kind: 'decoration'; decoration: DecorationId }
  | { kind: 'distinct-blooming'; count: number }
  | { kind: 'all'; of: ArrivalCondition[] };

export interface Species {
  id: SpeciesId;
  name: string;
  arrivalCondition: ArrivalCondition;
  /** Catalogue hint about the arrival condition (CRT-01 AC2). */
  hint: string;
}

/** Seeds every new planet starts with (ITM-04 AC1). */
export interface StarterItem {
  itemType: PlantId;
  count: number;
}
