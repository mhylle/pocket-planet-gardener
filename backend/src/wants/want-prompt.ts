import { extractJson } from '../ai/ai-gateway.service';
import type { ChatMessage } from '../ai/ai.types';
import type { TextLimits } from '../ai/content-rules';
import { findPrivateData, type PlanetPublicState } from '../ai/prompt-context';
import type { SpeciesId } from '../content/content.types';
import { DECORATIONS } from '../content/decorations';
import { decorationName, plantName } from '../content/fallback-wants';
import { PLANTS } from '../content/plants';
import { SPECIES } from '../content/species';
import type { CreatureIdentity } from '../creatures/identity.types';
import {
  DECORATION_IDS,
  evaluate,
  isAchievable,
  PLANT_IDS,
  WANT_LIMITS,
  WANT_TYPES,
  type DecorationId,
  type Home,
  type PlantId,
  type WantAnchor,
  type WantSpec,
  type WantType,
  type WantWorld,
} from './want-evaluator';

// The want prompt and how its answer is read and checked (WNT-01 AC3,
// WNT-02). The fallback pool is held to the same checks, so a fallback
// want is only ever one the model would have been allowed to make.

/** A want's text: the creature's own words, at most 2 sentences (SD section 10.1). */
export const WANT_TEXT_LIMITS: TextLimits = { maxSentences: 2, maxWords: 35 };

/** A want as the model writes it: the condition and the creature's words. */
export interface WrittenWant {
  spec: WantSpec;
  text: string;
}

/** The item a wistful creature asks to have back (CRT-04 AC3). */
export interface BringBackItem {
  itemKind: 'plant' | 'decoration';
  item: string;
}

/** What a new want must fit, beyond the content rules. */
export interface WantRules {
  unlocked: ReadonlySet<string>;
  maxPlants: number;
  plantCount: number;
  world: WantWorld;
  home: Home;
  // The first want of the tutorial creature: only items in owned (ONB-02 AC3).
  tutorial?: boolean;
  // Item type to how many the planet holds now.
  owned?: ReadonlyMap<string, number>;
  // When set, a bring-back of exactly this item is the only valid want.
  bringBack?: BringBackItem;
}

/** Everything the want prompt may be built from: public game facts only (AIB-02). */
export interface WantPromptInput {
  creature: { species: SpeciesId; name: string; identity: CreatureIdentity };
  memories: readonly string[];
  planet: PlanetPublicState;
  unlocked: ReadonlySet<string>;
  tutorial?: boolean;
  owned?: ReadonlyMap<string, number>;
  bringBack?: BringBackItem;
}

/** The want types that may be asked for: only bring-back for a wistful creature, never otherwise. */
export function allowedWantTypes(bringBack?: BringBackItem): WantType[] {
  return WANT_TYPES.filter((type) =>
    bringBack ? type === 'bring-back' : type !== 'bring-back',
  );
}

/** How each want type is written in the reply and what it means; a bring-back's spec is given whole. */
const SHAPES: Record<Exclude<WantType, 'bring-back'>, string> = {
  'plant-near':
    '{"type": "plant-near", "plant": "<plant id>", "count": <number>, "near": {"kind": "home"} or {"kind": "decoration", "decoration": "<decoration id>"}, "withinSteps": <number>} means that many plants of one kind within that many steps of the creature\'s home or of a decoration.',
  'count-blooming':
    '{"type": "count-blooming", "plant": "<plant id>", "count": <number>} means that many plants of one kind in bloom.',
  'place-decoration':
    '{"type": "place-decoration", "decoration": "<decoration id>"} means that decoration placed on the planet.',
  variety:
    '{"type": "variety", "distinct": <number>, "withinSteps": <number>} means that many different kinds of plant within that many steps of the creature\'s home.',
};

const RULES = `You write the next wish of a small creature that lives on a player's tiny planet in a cosy gardening game. The wish is something the player can make come true by planting or placing things on the planet.

Rules:
- Write the text in the creature's own voice, with its speaking style, traits and quirk: at most ${WANT_TEXT_LIMITS.maxSentences} short sentences, each ending with . ! or ?, no ellipses, and at most ${WANT_TEXT_LIMITS.maxWords} words. For example, a moth: "One requires moonflowers. Near the lamp-post, obviously."
- Warm, kind, playful and a little absurd. Suitable for all ages.
- The creature fits its species and only does what such an animal can do: a snail does not fly, a moth likes lamps.
- The creature asks kindly. It never demands, begs or sulks, and never guilt-trips or pressures the player.
- Never mention real people, real places or brands.
- No violence, nothing scary, no romance, no swearing, no alcohol, no drugs, no politics and no religion.
- The creature never asks for personal information and never claims to be a real animal or person.
- Use only the plant and decoration ids listed, and ask for something the planet does not have yet.
- Write in English.`;

function rangeText({ min, max }: { min: number; max: number }): string {
  return `${min} to ${max}`;
}

/** The system message: the rules and the form of the answer for the allowed types. */
function systemMessage(bringBack?: BringBackItem): string {
  const form = bringBack
    ? `{"spec": ${JSON.stringify(bringBackSpec(bringBack))}, "text": "..."}
- spec: exactly as given.`
    : `{"spec": {...}, "text": "..."}
- spec: one of these:
${Object.values(SHAPES)
  .map((shape) => `  ${shape}`)
  .join('\n')}
- Numbers are whole: count ${rangeText(WANT_LIMITS.count)}, distinct ${rangeText(WANT_LIMITS.distinct)}, withinSteps ${rangeText(WANT_LIMITS.withinSteps)}. A step is a short stride across the tiny planet.`;
  return `${RULES}

Answer with only a JSON object, no other text, in exactly this form:
${form}
- text: what the creature says, asking for exactly what the spec describes.`;
}

/** "3 clover (bloom), 1 sunflower (sprout)": each distinct item with how often it occurs. */
function tally(items: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  if (counts.size === 0) return 'none';
  return [...counts].map(([item, count]) => `${count} ${item}`).join(', ');
}

/** "clover (Clover), lamp-post (Lamp-post)", or "none". */
function idList(items: readonly { id: string; name: string }[]): string {
  if (items.length === 0) return 'none';
  return items.map((item) => `${item.id} (${item.name})`).join(', ');
}

/**
 * The plants and decorations the wish may name: every unlocked one, or in
 * the tutorial only those the player holds now, with how many.
 */
function itemLines(input: WantPromptInput): string[] {
  const holds = (id: string) => input.owned?.get(id) ?? 0;
  const usable = <T extends { id: string }>(items: readonly T[]) =>
    items.filter(
      (item) =>
        input.unlocked.has(item.id) && (!input.tutorial || holds(item.id) > 0),
    );
  const plants = usable(PLANTS);
  const decorations = usable(DECORATIONS);
  const lines = [
    `Plants it may ask for, by id: ${idList(plants)}.`,
    `Decorations it may ask for, by id: ${idList(decorations)}.`,
  ];
  if (input.tutorial) {
    const held = [...plants, ...decorations].map(
      (item) => `${holds(item.id)} ${item.id}`,
    );
    lines.push(
      `This is the creature's very first wish and the player is new, so it must be possible with only what the player holds now: ${held.join(', ') || 'nothing'}. Ask for no more plants of a kind than the player holds.`,
    );
  }
  return lines;
}

/** The messages that ask the model for a creature's next want as JSON. */
export function buildWantPrompt(input: WantPromptInput): ChatMessage[] {
  const { creature, planet, bringBack } = input;
  const { identity } = creature;
  const species = SPECIES.find((each) => each.id === creature.species);
  const others = planet.creatures
    .filter((other) => other.name !== creature.name)
    .map((other) => `- ${other.name} the ${other.species}: ${other.summary}`);
  // Memories may echo what a player typed; one that looks like an id or an
  // address stays out of the prompt.
  const memories = input.memories.filter(
    (memory) => findPrivateData(memory, []).length === 0,
  );

  const facts = [
    `The creature is ${creature.name} the ${creature.species}.`,
    species ? `About ${species.name.toLowerCase()}s: ${species.hint}` : '',
    `Traits: ${identity.traits.join(', ')}.`,
    `Quirk: ${identity.quirk}`,
    `Speaking style: ${identity.speakingStyle}.`,
    `About ${creature.name}: ${identity.backstory}`,
    memories.length > 0
      ? `${creature.name} remembers:\n${memories.map((memory) => `- ${memory}`).join('\n')}`
      : '',
    `It lives on the planet "${planet.name}".`,
    `Plants: ${tally(planet.plants.map((plant) => `${plant.type} (${plant.stage})`))}.`,
    `Decorations: ${tally(planet.decorations.map((decoration) => decoration.type))}.`,
    others.length > 0
      ? `Other creatures living here:\n${others.join('\n')}`
      : '',
    ...(bringBack
      ? [
          `The ${itemName(bringBack)} that ${creature.name} loved is gone from the planet. The wish asks for it back.`,
        ]
      : itemLines(input)),
    `Write ${creature.name}'s next wish.`,
  ];

  return [
    { role: 'system', content: systemMessage(bringBack) },
    { role: 'user', content: facts.filter((line) => line !== '').join('\n') },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlantId(value: unknown): value is PlantId {
  return PLANT_IDS.some((id) => id === value);
}

function isDecorationId(value: unknown): value is DecorationId {
  return DECORATION_IDS.some((id) => id === value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function parseAnchor(value: unknown): WantAnchor | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'home') return { kind: 'home' };
  if (value.kind === 'decoration' && isDecorationId(value.decoration)) {
    return { kind: 'decoration', decoration: value.decoration };
  }
  return null;
}

/**
 * The spec in a reply, its fields picked by name; null when the type is not
 * one of the want types, an item is not a catalogue id of the right kind or
 * a field has the wrong type. Ranges and unlocks are isAchievable's job.
 */
function parseSpec(value: unknown): WantSpec | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'plant-near': {
      const { plant, count, withinSteps } = value;
      const near = parseAnchor(value.near);
      return isPlantId(plant) &&
        isNumber(count) &&
        isNumber(withinSteps) &&
        near
        ? { type: 'plant-near', plant, count, near, withinSteps }
        : null;
    }
    case 'count-blooming': {
      const { plant, count } = value;
      return isPlantId(plant) && isNumber(count)
        ? { type: 'count-blooming', plant, count }
        : null;
    }
    case 'place-decoration':
      return isDecorationId(value.decoration)
        ? { type: 'place-decoration', decoration: value.decoration }
        : null;
    case 'variety': {
      const { distinct, withinSteps } = value;
      return isNumber(distinct) && isNumber(withinSteps)
        ? { type: 'variety', distinct, withinSteps }
        : null;
    }
    case 'bring-back': {
      const { itemKind, item } = value;
      if (itemKind === 'plant' && isPlantId(item)) {
        return { type: 'bring-back', itemKind, item };
      }
      if (itemKind === 'decoration' && isDecorationId(item)) {
        return { type: 'bring-back', itemKind, item };
      }
      return null;
    }
    default:
      return null;
  }
}

/** The want in a model reply, its text trimmed; null when it has the wrong form. */
export function parseWant(text: string): WrittenWant | null {
  const json = extractJson(text);
  if (!isRecord(json) || typeof json.text !== 'string') {
    return null;
  }
  const spec = parseSpec(json.spec);
  return spec ? { spec, text: json.text.trim() } : null;
}

/** The bring-back want for the item. */
export function bringBackSpec(item: BringBackItem): WantSpec {
  return { type: 'bring-back', itemKind: item.itemKind, item: item.item };
}

function itemName(item: BringBackItem): string {
  return item.itemKind === 'plant'
    ? plantName(item.item)
    : decorationName(item.item);
}

/**
 * Whether the player can meet the want with what they hold now (ONB-02
 * AC3): every plant it needs from seeds in owned (plants already on the
 * planet are not counted) and with room to plant them, a decoration to
 * place from owned, one to plant near already on the planet or owned.
 */
function fulfillableWithOwned(spec: WantSpec, rules: WantRules): boolean {
  const holds = (item: string) => rules.owned?.get(item) ?? 0;
  const freeSlots = rules.maxPlants - rules.plantCount;
  const seeds = (plant: string, count: number) =>
    count <= holds(plant) && count <= freeSlots;
  switch (spec.type) {
    case 'plant-near': {
      const near = spec.near;
      return (
        seeds(spec.plant, spec.count) &&
        (near.kind === 'home' ||
          holds(near.decoration) > 0 ||
          rules.world.decorations.some((d) => d.type === near.decoration))
      );
    }
    case 'count-blooming':
      return seeds(spec.plant, spec.count);
    case 'place-decoration':
      return holds(spec.decoration) > 0;
    case 'variety': {
      const kinds = PLANT_IDS.filter((plant) => holds(plant) > 0).length;
      return kinds >= spec.distinct && spec.distinct <= freeSlots;
    }
    case 'bring-back':
      return holds(spec.item) > 0;
  }
}

/**
 * What makes the want unusable beyond the content rules: a type that is not
 * allowed now, a bring-back of anything but the asked-for item, an item
 * that is not unlocked or a number out of range (WNT-02 AC1), a want the
 * planet already meets, and in the tutorial one the player cannot meet
 * with what they hold. [] means it may be offered. Worded for the retry.
 */
export function wantProblems(spec: WantSpec, rules: WantRules): string[] {
  const problems: string[] = [];
  const { bringBack } = rules;
  if (bringBack) {
    const wanted = bringBackSpec(bringBack);
    if (
      spec.type !== 'bring-back' ||
      spec.itemKind !== bringBack.itemKind ||
      spec.item !== bringBack.item
    ) {
      problems.push(
        `the spec must be exactly ${JSON.stringify(wanted)}, asking for the ${itemName(bringBack)} back`,
      );
    }
  } else if (spec.type === 'bring-back') {
    problems.push('the type must be one of the listed types');
  }
  if (!isAchievable(spec, rules)) {
    problems.push(
      'it may only name the listed ids, with whole numbers in the given ranges',
    );
  }
  // A missing bring-back item may still be on the planet in another form,
  // such as clover that is not blooming; it is asked for all the same.
  if (!bringBack && evaluate(spec, rules.world, rules.home)) {
    problems.push(
      'the planet already has that, so ask for something it does not have yet',
    );
  }
  if (rules.tutorial && !fulfillableWithOwned(spec, rules)) {
    problems.push(
      'it must be possible with only the items the player holds now',
    );
  }
  return problems;
}
