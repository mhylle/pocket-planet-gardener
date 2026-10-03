import { DECORATIONS } from '../content/decorations';
import { PLANTS } from '../content/plants';
import { SPECIES } from '../content/species';
import { STAGES, type Stage } from '../simulation/growth-rules';

// The privacy layer for AI prompts (AIB-02): builders accept only these
// types. Every mapper picks fields by name, so an id, the planet code or a
// position never reaches a prompt unless it is listed here.

/** The planet as a prompt may describe it: game facts only. */
export interface PlanetPublicState {
  name: string;
  plants: { type: string; stage: string }[];
  decorations: { type: string }[];
  creatures: { name: string; species: string; summary: string }[];
}

/** The fields a public state is built from; a snapshot has them all. */
export interface PublicStateSource {
  name: string;
  plants: readonly { type: string; stage: string }[];
  decorations: readonly { type: string }[];
  // Absent until creatures exist (Phase 11).
  creatures?: readonly { name: string; species: string; summary: string }[];
}

/** A logged event as a prompt may mention it. */
export interface PublicEvent {
  type: string;
  // ISO timestamp.
  occurredAt: string;
  // A short phrase such as "sunflower bloomed".
  detail: string;
}

/** The fields a public event is built from; a logged event or EventDto has them. */
export interface PublicEventSource {
  type: string;
  occurredAt: Date | string;
  payload: Record<string, unknown>;
}

const PLANT_IDS = new Set<string>(PLANTS.map((plant) => plant.id));
const DECORATION_IDS = new Set<string>(
  DECORATIONS.map((decoration) => decoration.id),
);
const SPECIES_IDS = new Set<string>(SPECIES.map((species) => species.id));
const STAGE_IDS = new Set<string>(STAGES);

/** How a plant-stage event reads for each stage. */
const STAGE_WORDING: Record<Stage, string> = {
  seed: 'was planted',
  sprout: 'sprouted',
  young: 'grew bigger',
  bloom: 'bloomed',
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Player-typed text without uuids or anything holding an '@'. */
function publicText(text: string): string {
  return text
    .replace(UUID, ' ')
    .replace(/\S*@\S*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The value when it is one of the known ids, otherwise undefined. */
function known(ids: ReadonlySet<string>, value: unknown): string | undefined {
  return typeof value === 'string' && ids.has(value) ? value : undefined;
}

/**
 * The planet's public state. Plants, decorations and creatures whose type,
 * stage or species is not a catalogue id are left out; names and summaries
 * lose uuids and anything holding an '@'.
 */
export function toPlanetPublicState(
  source: PublicStateSource,
): PlanetPublicState {
  return {
    name: publicText(source.name),
    plants: source.plants
      .filter(
        (plant) =>
          known(PLANT_IDS, plant.type) && known(STAGE_IDS, plant.stage),
      )
      .map((plant) => ({ type: plant.type, stage: plant.stage })),
    decorations: source.decorations
      .filter((decoration) => known(DECORATION_IDS, decoration.type))
      .map((decoration) => ({ type: decoration.type })),
    creatures: (source.creatures ?? [])
      .filter((creature) => known(SPECIES_IDS, creature.species))
      .map((creature) => ({
        name: publicText(creature.name),
        species: creature.species,
        summary: publicText(creature.summary),
      })),
  };
}

function speciesOf(payload: Record<string, unknown>): string {
  return known(SPECIES_IDS, payload.species) ?? 'creature';
}

/** "Mira the moth" from an event payload, or '' when the name or species is missing. */
function creatureOf(payload: Record<string, unknown>): string {
  const species = known(SPECIES_IDS, payload.species);
  const name = typeof payload.name === 'string' ? publicText(payload.name) : '';
  return name && species ? `${name} the ${species}` : '';
}

/** A short human phrase for an event, read from named payload fields only. */
function eventDetail(type: string, payload: Record<string, unknown>): string {
  const plant = known(PLANT_IDS, payload.type) ?? 'a plant';
  switch (type) {
    case 'plant-bloomed':
      return `${plant} bloomed`;
    case 'plant-stage': {
      const stage = STAGES.find((each) => each === payload.stage);
      return `${plant} ${stage ? STAGE_WORDING[stage] : 'grew'}`;
    }
    case 'creature-arrived': {
      const who = creatureOf(payload);
      return who ? `${who} moved in` : `a new ${speciesOf(payload)} moved in`;
    }
    case 'want-fulfilled': {
      const who = creatureOf(payload);
      return who ? `${who}'s wish came true` : 'a wish came true';
    }
    case 'gift-received': {
      const who = creatureOf(payload);
      return who ? `${who} gave the gardener a present` : 'a gift arrived';
    }
    default:
      return type.replace(/-/g, ' ');
  }
}

/** The events as prompts may see them, in the given order. */
export function toPublicEvents(
  events: readonly PublicEventSource[],
): PublicEvent[] {
  return events.map((event) => ({
    type: event.type,
    occurredAt:
      event.occurredAt instanceof Date
        ? event.occurredAt.toISOString()
        : event.occurredAt,
    detail: eventDetail(event.type, event.payload),
  }));
}

/**
 * The forbidden values found in a serialised prompt: each given secret, such
 * as the planet id or code (ignoring case), any uuid and any '@'. [] means
 * the prompt is clean; builder specs assert that.
 */
export function findPrivateData(
  text: string,
  secrets: readonly string[],
): string[] {
  const lower = text.toLowerCase();
  const found = secrets.filter(
    (secret) => secret.length > 0 && lower.includes(secret.toLowerCase()),
  );
  for (const uuid of text.match(UUID) ?? []) {
    found.push(uuid.toLowerCase());
  }
  if (text.includes('@')) found.push('@');
  return [...new Set(found)];
}
