import type { ArrivalCondition } from '../content/content.types';
import {
  isConditionMet,
  type GardenView,
} from '../creatures/arrival-conditions';
import type { CreatureMood } from '../creatures/creature.entity';
import type { BringBackItem } from './want-prompt';
import type { WantStatus } from './want.entity';

// A creature's mood and when it wants something next (CRT-04, WNT-01).

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The mood levels, lowest first. Never below content (CRT-04). */
const MOODS: readonly CreatureMood[] = ['content', 'cheerful', 'overjoyed'];

/** One level up for a fulfilled want, overjoyed at most (CRT-04 AC1). */
export function raiseMood(mood: CreatureMood): CreatureMood {
  return MOODS[Math.min(MOODS.indexOf(mood) + 1, MOODS.length - 1)];
}

/** When a creature that became overjoyed at moodSince gives its gift (CRT-04 AC2). */
export function giftDueAt(moodSince: Date, overjoyedGiftHours: number): Date {
  return new Date(moodSince.getTime() + overjoyedGiftHours * HOUR_MS);
}

/** A creature is wistful while its species' arrival condition no longer holds (CRT-04 AC3). */
export function isWistful(
  condition: ArrivalCondition,
  garden: GardenView,
): boolean {
  return !isConditionMet(condition, garden);
}

/**
 * What a wistful creature asks to have back (CRT-04 AC3): a decoration its
 * condition needs that is gone, else a plant type it needs in bloom of
 * which nothing at all is left on the planet. Undefined when nothing
 * specific is missing, such as a bloom that is only still growing or the
 * worm's first bloom.
 */
export function missingItem(
  condition: ArrivalCondition,
  garden: GardenView,
  plantTypes: ReadonlySet<string>,
): BringBackItem | undefined {
  const unmet = unmetParts(condition, garden);
  for (const part of unmet) {
    if (part.kind === 'decoration') {
      return { itemKind: 'decoration', item: part.decoration };
    }
  }
  for (const part of unmet) {
    if (part.kind === 'blooming' && !plantTypes.has(part.plant)) {
      return { itemKind: 'plant', item: part.plant };
    }
  }
  return undefined;
}

/**
 * Whether a creature with these wants gets a new one now: it has no active
 * want, and it never had one (the first comes at once, ONB-02 AC3) or its
 * last was fulfilled or put off wantCooldownMinutes ago or more (WNT-01
 * AC1, WNT-05 AC1).
 */
export function isWantDue(
  wants: readonly { status: WantStatus; resolvedAt: Date | null }[],
  now: Date,
  wantCooldownMinutes: number,
): boolean {
  if (wants.some((want) => want.status === 'active')) {
    return false;
  }
  const resolved = wants.map((want) => want.resolvedAt?.getTime() ?? 0);
  const last = Math.max(0, ...resolved);
  return (
    wants.length === 0 ||
    last + wantCooldownMinutes * MINUTE_MS <= now.getTime()
  );
}

/** The single conditions of a condition that do not hold, in content order. */
function unmetParts(
  condition: ArrivalCondition,
  garden: GardenView,
): ArrivalCondition[] {
  if (condition.kind === 'all') {
    return condition.of.flatMap((part) => unmetParts(part, garden));
  }
  return isConditionMet(condition, garden) ? [] : [condition];
}
