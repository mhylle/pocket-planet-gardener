/** The creature species of the first release (CRT-01). */
export type Species = 'worm' | 'snail' | 'bee' | 'moth' | 'hedgehog' | 'frog';

/** How happy a creature is; it never goes below content (CRT-04). */
export type Mood = 'content' | 'cheerful' | 'overjoyed';

/** A creature living on the planet, as the snapshot names it. */
export interface CreatureDto {
  id: string;
  species: Species;
  name: string;
  /** The one-line personality summary (NAV-03 AC2). */
  summary: string;
  traits: string[];
  quirk: string;
  speakingStyle: string;
  /** At most three sentences (CRT-03). */
  backstory: string;
  mood: Mood;
  /** Its arrival condition is no longer met, so it shows as "a bit wistful" (CRT-04 AC3). */
  wistful: boolean;
  /** The home spot it wanders around. */
  lat: number;
  lon: number;
  /** ISO timestamp. */
  arrivedAt: string;
  identitySource: 'ai' | 'fallback';
}
