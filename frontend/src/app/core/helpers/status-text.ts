import { LightPref, LightStatus, Stage, WaterPref, WaterStatus } from './growth-rules';

/** The shapes a status is drawn with; each status in a card has its own (SET-04). */
export type StatusIcon =
  | 'drop-empty'
  | 'drop-low'
  | 'drop-half'
  | 'drop-full'
  | 'drop-puddle'
  | 'drops'
  | 'sun'
  | 'sun-check'
  | 'sun-cloud'
  | 'moon'
  | 'seed'
  | 'sprout'
  | 'young'
  | 'bloom'
  | 'sparkle';

/**
 * A status in words with its icon, so it never relies on colour (SET-04), and what the player
 * could do about it when a need is not met (GRD-04 AC2).
 */
export interface StatusText {
  icon: StatusIcon;
  text: string;
  /** Null when all is well. */
  suggestion: string | null;
}

export const WATER_TEXT: Readonly<Record<WaterStatus, StatusText>> = {
  thirsty: { icon: 'drop-empty', text: 'Thirsty', suggestion: 'hold a cloud over it' },
  'a-bit-thirsty': {
    icon: 'drop-low',
    text: 'A bit thirsty',
    suggestion: 'a little rain would help',
  },
  happy: { icon: 'drop-full', text: 'Happy', suggestion: null },
  soggy: { icon: 'drop-puddle', text: 'Soggy', suggestion: 'let it dry out' },
};

export const LIGHT_TEXT: Readonly<Record<LightStatus, StatusText>> = {
  'too-sunny': { icon: 'sun', text: 'A bit too sunny', suggestion: 'move the sun away' },
  'too-dark': { icon: 'moon', text: 'A bit too dark', suggestion: 'drag the sun over it' },
  ok: { icon: 'sun-check', text: 'Just the right light', suggestion: null },
};

export const STAGE_TEXT: Readonly<Record<Stage, StatusText>> = {
  seed: { icon: 'seed', text: 'Seed', suggestion: null },
  sprout: { icon: 'sprout', text: 'Sprout', suggestion: null },
  young: { icon: 'young', text: 'Young', suggestion: null },
  bloom: { icon: 'bloom', text: 'In bloom', suggestion: null },
};

/** A bloom whose seeds are ready to collect (GRD-08 AC1). */
export const SEEDS_READY_TEXT: StatusText = {
  icon: 'sparkle',
  text: 'In bloom, seeds ready',
  suggestion: 'tap it to collect them',
};

/** What a plant type likes, for the catalogue (ITM-03 AC2). */
export const WATER_PREF_TEXT: Readonly<Record<WaterPref, StatusText>> = {
  low: { icon: 'drop-low', text: 'Likes a little water', suggestion: null },
  medium: { icon: 'drop-half', text: 'Likes some water', suggestion: null },
  high: { icon: 'drops', text: 'Likes lots of water', suggestion: null },
};

export const LIGHT_PREF_TEXT: Readonly<Record<LightPref, StatusText>> = {
  shade: { icon: 'moon', text: 'Likes the shade', suggestion: null },
  partial: { icon: 'sun-cloud', text: 'Likes some sun', suggestion: null },
  'full-sun': { icon: 'sun', text: 'Likes full sun', suggestion: null },
};

export function waterText(status: WaterStatus): StatusText {
  return WATER_TEXT[status];
}

export function lightText(status: LightStatus): StatusText {
  return LIGHT_TEXT[status];
}

export function stageText(stage: Stage, harvestReady: boolean): StatusText {
  return stage === 'bloom' && harvestReady ? SEEDS_READY_TEXT : STAGE_TEXT[stage];
}

/** A plant type's water and light preferences, in that order. */
export function needsText(needs: { waterPref: WaterPref; lightPref: LightPref }): StatusText[] {
  return [WATER_PREF_TEXT[needs.waterPref], LIGHT_PREF_TEXT[needs.lightPref]];
}

/** The status as one line, such as "Thirsty — hold a cloud over it". */
export function statusLine({ text, suggestion }: StatusText): string {
  return suggestion ? `${text} — ${suggestion}` : text;
}
