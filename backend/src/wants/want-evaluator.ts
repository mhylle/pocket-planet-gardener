/*
 * What a creature wants and whether it has it (plan D-10, Task 12.2, WNT-02,
 * WNT-03, GRD-07 AC3). This file exists twice, in backend/src/wants and
 * frontend/src/app/core/helpers, and the backend spec fails when the copies
 * differ: change both together. The 80-column backend Prettier and the
 * 100-column frontend one must both leave it as it is, hence the
 * prettier-ignore on the wrapped lists and signatures. In the backend,
 * ./surface-coords re-exports the simulation copy.
 */
import { stepsBetween, type SurfacePoint } from './surface-coords';

/** Every plant type, as in the content catalogue (a backend spec checks). */
export const PLANT_IDS = [
  'clover',
  'sunflower',
  'tulip',
  'bluebell',
  'moonflower',
  'mushroom',
  'fern',
  'cactus',
] as const;

/** Every decoration type, as in the content catalogue. */
// prettier-ignore
export const DECORATION_IDS = [
  'pond',
  'rock',
  'lamp-post',
  'bench',
  'tiny-house',
] as const;

export type PlantId = (typeof PLANT_IDS)[number];

export type DecorationId = (typeof DECORATION_IDS)[number];

const PLANT_SET: ReadonlySet<string> = new Set(PLANT_IDS);

const DECORATION_SET: ReadonlySet<string> = new Set(DECORATION_IDS);

/** Near every decoration of one type. */
export interface DecorationAnchor {
  kind: 'decoration';
  decoration: DecorationId;
}

/** Near the creature's home spot. */
export interface HomeAnchor {
  kind: 'home';
}

export type WantAnchor = DecorationAnchor | HomeAnchor;

/** Plants of one type, at any stage, near a decoration or the home. */
export interface PlantNearWant {
  type: 'plant-near';
  plant: PlantId;
  count: number;
  near: WantAnchor;
  withinSteps: number;
}

/** Plants of one type in bloom, anywhere. */
export interface CountBloomingWant {
  type: 'count-blooming';
  plant: PlantId;
  count: number;
}

/** A decoration of one type, anywhere. */
export interface PlaceDecorationWant {
  type: 'place-decoration';
  decoration: DecorationId;
}

/** Different plant types, at any stage, near the creature's home. */
export interface VarietyWant {
  type: 'variety';
  distinct: number;
  withinSteps: number;
}

/**
 * A plant or decoration of one type back on the planet, asked for after the
 * one the creature's arrival needed was removed (CRT-04 AC3).
 */
export interface BringBackWant {
  type: 'bring-back';
  itemKind: 'plant' | 'decoration';
  item: string;
}

/** A want's condition (WNT-02): what the game checks, not what is said. */
// prettier-ignore
export type WantSpec =
  | PlantNearWant
  | CountBloomingWant
  | PlaceDecorationWant
  | VarietyWant
  | BringBackWant;

export type WantType = WantSpec['type'];

/** The want types a creature may ask for (WNT-02). */
export const WANT_TYPES: readonly WantType[] = [
  'plant-near',
  'count-blooming',
  'place-decoration',
  'variety',
  'bring-back',
];

/** The whole numbers an achievable want stays within, inclusive. */
export const WANT_LIMITS = {
  count: { min: 1, max: 5 },
  distinct: { min: 2, max: 4 },
  withinSteps: { min: 1, max: 6 },
} as const;

/** A plant or decoration on the surface, in degrees. */
export interface WantItem {
  type: string;
  lat: number;
  lon: number;
}

/** A plant, with its growth stage, such as 'bloom'. */
export interface WantPlant extends WantItem {
  stage: string;
}

/** What is on the planet. */
export interface WantWorld {
  plants: WantPlant[];
  decorations: WantItem[];
}

/** The creature's home spot, in degrees. */
export interface Home {
  lat: number;
  lon: number;
}

/** What a want must fit to be offered. */
export interface WantCapacity {
  /** Item types the planet has unlocked (WNT-02 AC1). */
  unlocked: ReadonlySet<string>;
  maxPlants: number;
  /** Plants on the planet now. Counts are held to maxPlants alone. */
  plantCount: number;
}

/** Display names, such as the catalogue's, for describe(). */
export interface WantNames {
  plant(id: string): string;
  decoration(id: string): string;
  creatureName: string;
}

/** Plurals that adding an s gets wrong. */
const IRREGULAR_PLURALS: Partial<Record<string, string>> = { cactus: 'cacti' };

/** A lower-case noun for a count: clover for 1, clovers or cacti for more. */
export function plural(noun: string, count: number): string {
  if (count === 1) {
    return noun;
  }
  return IRREGULAR_PLURALS[noun] ?? `${noun}s`;
}

/** Whether the want is met right now (WNT-02 AC3). */
// prettier-ignore
export function evaluate(
  spec: WantSpec,
  world: WantWorld,
  home: Home,
): boolean {
  switch (spec.type) {
    case 'plant-near': {
      const anchors = anchorPoints(spec.near, world, home);
      const near = world.plants.filter(
        (p) => p.type === spec.plant && isNear(p, anchors, spec.withinSteps),
      );
      return near.length >= spec.count;
    }
    case 'count-blooming': {
      const blooms = world.plants.filter(
        (p) => p.type === spec.plant && p.stage === 'bloom',
      );
      return blooms.length >= spec.count;
    }
    case 'place-decoration':
      return world.decorations.some((d) => d.type === spec.decoration);
    case 'variety': {
      const near = world.plants.filter((p) =>
        isNear(p, [home], spec.withinSteps),
      );
      return new Set(near.map((p) => p.type)).size >= spec.distinct;
    }
    case 'bring-back': {
      const items: WantItem[] =
        spec.itemKind === 'plant' ? world.plants : world.decorations;
      return items.some((item) => item.type === spec.item);
    }
  }
}

/**
 * Whether the want may be offered: every item it names is a real, unlocked
 * one (WNT-02 AC1) and its numbers are whole and within WANT_LIMITS, counts
 * also within maxPlants. Safe on unchecked input, such as a parsed AI reply:
 * anything malformed is not achievable (WNT-02 AC4).
 */
export function isAchievable(spec: WantSpec, capacity: WantCapacity): boolean {
  if (typeof spec !== 'object' || spec === null) {
    return false;
  }
  const { unlocked, maxPlants } = capacity;
  const count = (n: number) => isWhole(n, WANT_LIMITS.count) && n <= maxPlants;
  const steps = (n: number) => isWhole(n, WANT_LIMITS.withinSteps);

  switch (spec.type) {
    case 'plant-near':
      return (
        isPlant(spec.plant, unlocked) &&
        count(spec.count) &&
        steps(spec.withinSteps) &&
        isAnchor(spec.near, unlocked)
      );
    case 'count-blooming':
      return isPlant(spec.plant, unlocked) && count(spec.count);
    case 'place-decoration':
      return isDecoration(spec.decoration, unlocked);
    case 'variety':
      return (
        isWhole(spec.distinct, WANT_LIMITS.distinct) &&
        spec.distinct <= maxPlants &&
        steps(spec.withinSteps)
      );
    case 'bring-back':
      return spec.itemKind === 'plant'
        ? isPlant(spec.item, unlocked)
        : spec.itemKind === 'decoration' && isDecoration(spec.item, unlocked);
    default:
      return false;
  }
}

/**
 * The plain description shown beside the creature's words (WNT-02 AC2),
 * such as "2 moonflowers within 3 steps of the lamp-post".
 */
export function describe(spec: WantSpec, names: WantNames): string {
  switch (spec.type) {
    case 'plant-near': {
      const plants = counted(spec.count, names.plant(spec.plant));
      const near =
        spec.near.kind === 'home'
          ? homeOf(names)
          : `the ${lower(names.decoration(spec.near.decoration))}`;
      return `${plants} within ${counted(spec.withinSteps, 'step')} of ${near}`;
    }
    case 'count-blooming':
      return `${counted(spec.count, names.plant(spec.plant))} in bloom`;
    case 'place-decoration': {
      const name = lower(names.decoration(spec.decoration));
      return `${startsWithVowel(name) ? 'An' : 'A'} ${name} on the planet`;
    }
    case 'variety': {
      const steps = counted(spec.withinSteps, 'step');
      return `${spec.distinct} different plants within ${steps} of ${homeOf(names)}`;
    }
    case 'bring-back': {
      if (spec.itemKind === 'decoration') {
        return `Bring back the ${lower(names.decoration(spec.item))}`;
      }
      const name = lower(names.plant(spec.item));
      return `Bring back ${startsWithVowel(name) ? 'an' : 'a'} ${name}`;
    }
  }
}

/**
 * Whether removing or moving this plant could undo the want (GRD-07 AC3): it
 * is of the type the want names and, for near and variety wants, inside the
 * radius. A variety want names no type, so any plant inside counts.
 */
// prettier-ignore
export function dependsOn(
  spec: WantSpec,
  plant: WantItem,
  world: WantWorld,
  home: Home,
): boolean {
  switch (spec.type) {
    case 'plant-near': {
      const anchors = anchorPoints(spec.near, world, home);
      return (
        plant.type === spec.plant && isNear(plant, anchors, spec.withinSteps)
      );
    }
    case 'count-blooming':
      return plant.type === spec.plant;
    case 'place-decoration':
      return false;
    case 'variety':
      return isNear(plant, [home], spec.withinSteps);
    case 'bring-back':
      return spec.itemKind === 'plant' && plant.type === spec.item;
  }
}

/** The points a plant-near want's plants must be near. */
// prettier-ignore
function anchorPoints(
  near: WantAnchor,
  world: WantWorld,
  home: Home,
): SurfacePoint[] {
  if (near.kind === 'home') {
    return [home];
  }
  return world.decorations.filter((d) => d.type === near.decoration);
}

/** Whether a point is within the given steps of any of the anchors. */
// prettier-ignore
function isNear(
  point: SurfacePoint,
  anchors: SurfacePoint[],
  steps: number,
): boolean {
  return anchors.some((anchor) => stepsBetween(point, anchor) <= steps);
}

/** A plant-near want's anchor is the home or an unlocked decoration. */
function isAnchor(near: WantAnchor, unlocked: ReadonlySet<string>): boolean {
  if (near?.kind === 'decoration') {
    return isDecoration(near.decoration, unlocked);
  }
  return near?.kind === 'home';
}

function isPlant(id: string, unlocked: ReadonlySet<string>): boolean {
  return PLANT_SET.has(id) && unlocked.has(id);
}

function isDecoration(id: string, unlocked: ReadonlySet<string>): boolean {
  return DECORATION_SET.has(id) && unlocked.has(id);
}

function isWhole(n: number, range: { min: number; max: number }): boolean {
  return Number.isInteger(n) && n >= range.min && n <= range.max;
}

/** A count and its noun, such as "2 moonflowers". */
function counted(count: number, name: string): string {
  return `${count} ${plural(lower(name), count)}`;
}

function homeOf(names: WantNames): string {
  return `${names.creatureName}'s home`;
}

function lower(name: string): string {
  return name.toLowerCase();
}

function startsWithVowel(word: string): boolean {
  return /^[aeiou]/.test(word);
}
