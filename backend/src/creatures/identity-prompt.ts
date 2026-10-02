import { extractJson } from '../ai/ai-gateway.service';
import type { ChatMessage } from '../ai/ai.types';
import { sentenceCount, wordCount } from '../ai/content-rules';
import { findPrivateData, type PlanetPublicState } from '../ai/prompt-context';
import { BLOCKED_NAMES } from '../content/blocked-names';
import { BLOCKED_WORDS } from '../content/blocked-words';
import type { Species, SpeciesId } from '../content/content.types';
import { SPECIES } from '../content/species';
import { validateName } from '../planets/name-rules';
import type { CreatureIdentity } from './identity.types';

// The identity prompt and how its answer is read and checked (CRT-03). The
// same checks hold for the fallback pool, so its content spec uses them too.

/** How long each part of an identity may be (SD section 10.1: short). */
export const IDENTITY_LIMITS = {
  name: { min: 1, max: 20 },
  minTraits: 2,
  maxTraits: 3,
  traitWords: 3,
  quirkSentences: 2,
  speakingStyleWords: 12,
  backstorySentences: 3,
  summaryWords: 12,
};

/** A name may hold neither a blocked word nor a famous name (SD section 10.2). */
const NAME_BLOCKLIST = [...BLOCKED_WORDS, ...BLOCKED_NAMES];

// SpeciesId comes from the content, so every species is listed here.
const SPECIES_BY_ID = Object.fromEntries(
  SPECIES.map((species) => [species.id, species]),
) as Record<SpeciesId, Species>;

/** Everything the identity prompt may be built from: public game facts only (AIB-02). */
export interface IdentityPromptInput {
  species: SpeciesId;
  planet: PlanetPublicState;
  existingNames: readonly string[];
}

const RULES = `You create the identity of a small creature that has just moved in to a player's tiny planet in a cosy gardening game.

Rules:
- Warm, kind, playful and a little absurd. Suitable for all ages.
- The humour comes from the creature's own quirk and the small world of the planet, never from mocking anyone.
- The creature fits its species and only does what such an animal can do: a snail does not fly, a moth likes lamps.
- Give it a name, traits and a quirk that differ from the creatures already living on the planet.
- Never mention real people, real places or brands. Never use the name of a well-known fictional character or celebrity.
- No violence, nothing scary, no romance, no swearing, no alcohol, no drugs, no politics and no religion.
- Moods are happy or calm, at most a bit wistful. Never guilt-trip or pressure the player.
- The creature never asks for personal information and never claims to be a real animal or person.
- Write in English.

Answer with only a JSON object, no other text, in exactly this form:
{"name": "...", "traits": ["...", "..."], "quirk": "...", "speakingStyle": "...", "backstory": "...", "summary": "..."}
- name: a short, original first name of at most ${IDENTITY_LIMITS.name.max} characters, not one already used on the planet.
- traits: ${IDENTITY_LIMITS.minTraits} or ${IDENTITY_LIMITS.maxTraits} short adjectives.
- quirk: one sentence.
- speakingStyle: a short phrase describing how it talks.
- backstory: at most ${IDENTITY_LIMITS.backstorySentences} sentences.
- summary: one line of at most ${IDENTITY_LIMITS.summaryWords} words.`;

/** "3 clover (bloom), 1 sunflower (sprout)": each distinct item with how often it occurs. */
function tally(items: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  if (counts.size === 0) return 'none';
  return [...counts].map(([item, count]) => `${count} ${item}`).join(', ');
}

/** The messages that ask the model for a new creature's identity as JSON. */
export function buildIdentityPrompt(input: IdentityPromptInput): ChatMessage[] {
  const species = SPECIES_BY_ID[input.species];
  const { planet } = input;
  const residents = planet.creatures.map(
    (creature) =>
      `- ${creature.name} the ${creature.species}: ${creature.summary}`,
  );
  // Names are player-editable; one that looks like an id or an address stays
  // out of the prompt but is still checked against.
  const takenNames = input.existingNames.filter(
    (name) => findPrivateData(name, []).length === 0,
  );

  const facts = [
    `A new ${species.name.toLowerCase()} has just moved in to the planet "${planet.name}".`,
    `About ${species.name.toLowerCase()}s: ${species.hint}`,
    `Plants: ${tally(planet.plants.map((plant) => `${plant.type} (${plant.stage})`))}.`,
    `Decorations: ${tally(planet.decorations.map((decoration) => decoration.type))}.`,
    residents.length > 0
      ? `Creatures already living here:\n${residents.join('\n')}`
      : 'No other creatures live here yet.',
    takenNames.length > 0
      ? `Names already used on the planet: ${takenNames.join(', ')}.`
      : '',
    `Create this ${input.species}'s identity.`,
  ];

  return [
    { role: 'system', content: RULES },
    { role: 'user', content: facts.filter((line) => line !== '').join('\n') },
  ];
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** The identity in a model reply, strings trimmed; null when a field is missing or of the wrong type. */
export function parseIdentity(text: string): CreatureIdentity | null {
  const json = extractJson(text);
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return null;
  }
  const { name, traits, quirk, speakingStyle, backstory, summary } =
    json as Record<string, unknown>;
  if (
    !isString(name) ||
    !isString(quirk) ||
    !isString(speakingStyle) ||
    !isString(backstory) ||
    !isString(summary) ||
    !Array.isArray(traits) ||
    !traits.every(isString)
  ) {
    return null;
  }
  return {
    name: name.trim(),
    traits: traits.map((trait) => trait.trim()),
    quirk: quirk.trim(),
    speakingStyle: speakingStyle.trim(),
    backstory: backstory.trim(),
    summary: summary.trim(),
  };
}

/**
 * What breaks the identity rules that checkText cannot see: the name rules,
 * a name already used on the planet (ignoring case) and the length limits.
 * [] means it may be used. Worded for the model's retry.
 */
export function identityProblems(
  identity: CreatureIdentity,
  existingNames: readonly string[],
): string[] {
  const limits = IDENTITY_LIMITS;
  const problems: string[] = [];
  const nameCheck = validateName(identity.name, limits.name, NAME_BLOCKLIST);
  if (nameCheck === 'too-short' || nameCheck === 'too-long') {
    problems.push(
      `the name must be ${limits.name.min} to ${limits.name.max} characters long`,
    );
  } else if (nameCheck === 'offensive') {
    problems.push(
      'the name must be original, not a famous character, a celebrity or a rude word',
    );
  }
  const name = identity.name.trim().toLowerCase();
  if (existingNames.some((each) => each.trim().toLowerCase() === name)) {
    problems.push(`the name "${identity.name}" is already used on the planet`);
  }
  if (
    identity.traits.length < limits.minTraits ||
    identity.traits.length > limits.maxTraits
  ) {
    problems.push(
      `it needs ${limits.minTraits} or ${limits.maxTraits} traits, not ${identity.traits.length}`,
    );
  }
  if (identity.traits.some((trait) => wordCount(trait) > limits.traitWords)) {
    problems.push('each trait must be a short adjective');
  }
  if (sentenceCount(identity.quirk) > limits.quirkSentences) {
    problems.push('the quirk must be one sentence');
  }
  if (wordCount(identity.speakingStyle) > limits.speakingStyleWords) {
    problems.push(
      `the speaking style must be a short phrase of at most ${limits.speakingStyleWords} words`,
    );
  }
  if (sentenceCount(identity.backstory) > limits.backstorySentences) {
    problems.push(
      `the backstory had more than ${limits.backstorySentences} sentences`,
    );
  }
  if (wordCount(identity.summary) > limits.summaryWords) {
    problems.push(`the summary was longer than ${limits.summaryWords} words`);
  }
  return problems;
}

/** Every text of the identity a player will read, for checkText. */
export function identityTexts(identity: CreatureIdentity): string[] {
  return [
    identity.name,
    ...identity.traits,
    identity.quirk,
    identity.speakingStyle,
    identity.backstory,
    identity.summary,
  ];
}
