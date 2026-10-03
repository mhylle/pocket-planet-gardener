import type { ChatMessage } from '../ai/ai.types';
import type { PlanetPublicState, PublicEvent } from '../ai/prompt-context';
import type { JournalViolation } from './journal-fact-check';

// The journal prompt (JRN-01, JRN-02) and how its answer is read. The
// builder takes only prompt-context types (AIB-02).

/** The longest text an entry may store. */
export const JOURNAL_TEXT_MAX = 2000;

/** Growth steps are left out: not news, and an invitation to count plants. */
const QUIET_EVENT = 'plant-stage';

/** Everything the journal prompt may be built from (AIB-02). */
export interface JournalPromptInput {
  // Such as "Thursday 2 October".
  date: string;
  planet: PlanetPublicState;
  // Logged since the previous entry, oldest first.
  events: readonly PublicEvent[];
  maxWords: number;
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

/** One line per distinct event, "sunflower bloomed (3 times)", in the order they first happened. */
function newsLines(events: readonly PublicEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type !== QUIET_EVENT) {
      counts.set(event.detail, (counts.get(event.detail) ?? 0) + 1);
    }
  }
  return [...counts].map(([detail, count]) =>
    count === 1 ? `- ${detail}` : `- ${detail} (${count} times)`,
  );
}

function rules(maxWords: number): string {
  return `You write the diary of a tiny planet in a cosy gardening game. The gardener, the player who looks after the planet, reads one page each time they come back.

Rules:
- Write one diary page of at most ${maxWords} words: one or two short paragraphs of plain text, with no title, no date line and no markdown.
- Warm, kind, funny and a little absurd. Suitable for all ages.
- Mention the creatures who live on the planet by name, and only those creatures. Never make up a creature or a name.
- Stay true to the news. Every concrete event you mention, such as a bloom, a creature moving in, a wish coming true or a gift, must be in the news list. Never invent anything that changed on the planet: no other blooms, no new creatures, no gifts, parcels or presents, no wishes coming true, no new plants or decorations.
- Give no numbers of plants or flowers, except how many bloomed according to the news.
- You may add harmless colour: how the creatures felt, small jokes, what they "thought", the weather, the drifting clouds, a nap.
- If the news is empty, write a short, cosy page about a quiet day, for example about the weather or a creature's nap.
- Never guilt-trip or pressure the gardener: nobody was lonely or waited for them, and never ask them to come back.
- Never mention real people, real places or brands. No violence, nothing scary, no romance, no swearing, no alcohol, no drugs, no politics and no religion.
- Write in English.`;
}

/** The messages that ask the model for a journal entry as plain text. */
export function buildJournalPrompt(input: JournalPromptInput): ChatMessage[] {
  const { planet } = input;
  const residents = planet.creatures.map(
    (creature) =>
      `- ${creature.name} the ${creature.species}: ${creature.summary}`,
  );
  const news = newsLines(input.events);

  const facts = [
    `Today is ${input.date}.`,
    `The planet is called "${planet.name}".`,
    `Plants: ${tally(planet.plants.map((plant) => `${plant.type} (${plant.stage})`))}.`,
    `Decorations: ${tally(planet.decorations.map((decoration) => decoration.type))}.`,
    residents.length > 0
      ? `Creatures living here:\n${residents.join('\n')}`
      : 'No creatures live here yet.',
    news.length > 0
      ? `News since the last diary page, oldest first:\n${news.join('\n')}`
      : 'News since the last diary page: none, it was a quiet time.',
    "Write today's diary page.",
  ];

  return [
    { role: 'system', content: rules(input.maxWords) },
    { role: 'user', content: facts.join('\n') },
  ];
}

/** The entry in a model reply, without a code fence; null when it is empty or too long to store. */
export function parseJournal(text: string): string | null {
  const page = text
    .trim()
    .replace(/^```[\w-]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
  return page.length > 0 && page.length <= JOURNAL_TEXT_MAX ? page : null;
}

/** What each fact-check violation means, worded for the model's retry. */
const PROBLEMS: Record<JournalViolation, string> = {
  'unknown-creature': 'it named a creature that does not live on the planet',
  'invented-gift':
    'it mentioned a gift, parcel or present that is not in the news',
  'invented-arrival':
    'it said someone arrived or moved in, which is not in the news',
  'invented-bloom': 'it said something bloomed, which is not in the news',
  'invented-wish': 'it said a wish came true, which is not in the news',
  'wrong-count':
    'it gave a number of plants or blooms that the news does not support',
  'too-long': 'it was too long',
};

/** The violations in words the model can act on. */
export function describeViolations(
  violations: readonly JournalViolation[],
): string[] {
  return violations.map((violation) => PROBLEMS[violation]);
}
