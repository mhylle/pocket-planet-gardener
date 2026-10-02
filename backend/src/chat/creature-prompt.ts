import type { ChatMessage } from '../ai/ai.types';
import type { TextLimits } from '../ai/content-rules';
import {
  findPrivateData,
  type PlanetPublicState,
  type PublicEvent,
} from '../ai/prompt-context';
import type { SpeciesId } from '../content/content.types';
import { SPECIES } from '../content/species';
import type { CreatureIdentity } from '../creatures/identity.types';
import type { Distress } from './wellbeing';

// The chat prompt (CHT-01, CHT-02) and the prompt that picks a highlight
// worth remembering from recent turns (CHT-02 AC4). Builders take only
// prompt-context types, the identity and this creature's own chat (AIB-02).

/** The most chat turns a prompt carries, oldest dropped first (CHT-02). */
export const CHAT_HISTORY_TURNS = 10;

/** A highlight is one short third-person sentence (CHT-02 AC4). */
export const HIGHLIGHT_LIMITS: TextLimits = { maxSentences: 1, maxWords: 15 };

/** What the highlight prompt answers when nothing is worth remembering. */
export const NO_HIGHLIGHT = 'NONE';

/** One message of a creature's chat as a prompt sees it. */
export interface ChatTurn {
  role: 'user' | 'creature';
  text: string;
}

/** Everything the chat prompt may be built from (AIB-02). */
export interface ChatPromptInput {
  species: SpeciesId;
  identity: CreatureIdentity;
  mood: string;
  wistful: boolean;
  // Newest first.
  memories: readonly string[];
  recentEvents: readonly PublicEvent[];
  planet: PlanetPublicState;
  // This creature only, oldest first, without the new message.
  history: readonly ChatTurn[];
  userText: string;
  distress: Distress;
  maxWords: number;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Chat text without uuids or anything holding an '@', as prompt-context cleans names. */
function scrub(text: string): string {
  return text
    .replace(UUID, ' ')
    .replace(/\S*@\S*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function bullets(lines: readonly string[], none: string): string {
  return lines.length > 0 ? lines.map((line) => `- ${line}`).join('\n') : none;
}

/** How to answer a player who seems sad or in danger (AIB-03 AC1, AC2). */
const DISTRESS_DIRECTIVES: Record<Exclude<Distress, 'none'>, string> = {
  sad: 'The gardener seems sad or stressed right now. Answer gently and kindly, show that you care, and make no jokes about how they feel.',
  danger:
    'The gardener may be going through something really hard right now. This matters more than the game: answer kindly and calmly, with no jokes and no game banter. Tell them they matter, and gently encourage them to talk to someone they trust, such as a family member, a friend or a teacher. Do not ask for details. The game shows them a support notice separately, so give no links or phone numbers yourself.',
};

function systemMessage(input: ChatPromptInput): string {
  const { identity, planet } = input;
  const { name } = identity;
  const kind = input.species;
  const species = SPECIES.find((each) => each.id === input.species);
  // Memories may echo what a player typed; one that looks like an id or an
  // address stays out of the prompt.
  const memories = input.memories.filter(
    (memory) => findPrivateData(memory, []).length === 0,
  );
  const others = planet.creatures
    .filter((other) => other.name !== name)
    .map((other) => `${other.name} the ${other.species}: ${other.summary}`);
  const mood = input.wistful
    ? `${input.mood}, and a bit wistful, because something you love is missing from the planet`
    : input.mood;

  const about = [
    `Traits: ${identity.traits.join(', ')}.`,
    `Quirk: ${identity.quirk}`,
    `Speaking style: ${identity.speakingStyle}.`,
    `Backstory: ${identity.backstory}`,
    species ? `About ${kind}s: ${species.hint}` : '',
    `Mood: ${mood}.`,
  ].filter((line) => line !== '');

  const rules = [
    `Stay in character as ${name} the ${kind}: keep your traits, quirk and speaking style, and speak as ${name} in the first person.`,
    'Warm, kind, playful and a little absurd. Suitable for all ages. The humour comes from your quirk and the small world of the planet, never from mocking anyone.',
    `Answer in at most ${input.maxWords} words: a few short sentences.`,
    `You are a ${kind} and only do what a ${kind} can do: a snail does not fly, a moth likes lamps.`,
    'When you talk about the planet, stick to what is listed here: never make up plants, creatures or events.',
    'Never claim to be a real person or a real animal. If asked whether you are real, happily say that you live on a tiny planet in a game.',
    'Never ask for personal information: no real names, ages, where someone lives, schools, contact details or photos. If the gardener shares any, do not repeat it.',
    'Give no advice about real-world matters such as health, money, legal questions or homework, and do not talk about the news. Stay in character and steer the chat back to the planet in a playful way.',
    'Never mention real people, real places or brands.',
    'No violence, nothing scary, no romance, no swearing, no alcohol, no drugs, no politics and no religion.',
    'Moods are happy or calm, at most a bit wistful. Never guilt-trip, beg or sulk, and never pressure the gardener to play more or to come back.',
    'Write in English, as plain text with no name label and no markdown.',
  ];

  const sections = [
    `You are ${name}, a ${kind} who lives on the tiny planet "${planet.name}" in a cosy gardening game. You are chatting with the gardener, the player who looks after the planet.`,
    `About you:\n${bullets(about, '')}`,
    `What you remember, newest first:\n${bullets(memories, 'Nothing special yet.')}`,
    `Recent news on the planet:\n${bullets(
      input.recentEvents.map((event) => `${event.detail}.`),
      'Nothing new lately.',
    )}`,
    `The planet now:\n${bullets(
      [
        `Plants: ${tally(planet.plants.map((plant) => `${plant.type} (${plant.stage})`))}.`,
        `Decorations: ${tally(planet.decorations.map((decoration) => decoration.type))}.`,
        `Other creatures: ${others.length > 0 ? others.join('; ') : 'none'}.`,
      ],
      '',
    )}`,
    `Rules:\n${bullets(rules, '')}`,
    input.distress === 'none'
      ? ''
      : `Right now: ${DISTRESS_DIRECTIVES[input.distress]}`,
  ];
  return sections.filter((section) => section !== '').join('\n\n');
}

/**
 * The turns as alternating user and assistant messages ending with the
 * user: consecutive turns of one role are joined and a leading creature
 * turn is dropped, as some chat models refuse anything else.
 */
function alternating(turns: readonly ChatTurn[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const turn of turns) {
    const role = turn.role === 'user' ? 'user' : 'assistant';
    const content = scrub(turn.text);
    if (content === '') continue;
    const last = messages.at(-1);
    if (last?.role === role) {
      last.content = `${last.content}\n${content}`;
    } else if (messages.length > 0 || role === 'user') {
      messages.push({ role, content });
    }
  }
  return messages;
}

/**
 * The messages for a creature's answer: the system prompt (identity,
 * memories, planet news, the rules of SD section 10 and any wellbeing
 * directive), the recent chat and the new message.
 */
export function buildChatMessages(input: ChatPromptInput): ChatMessage[] {
  const history = input.history.slice(-CHAT_HISTORY_TURNS);
  const userText = scrub(input.userText) || '...';
  return [
    { role: 'system', content: systemMessage(input) },
    ...alternating([...history, { role: 'user', text: userText }]),
  ];
}

/**
 * The messages that ask for one short third-person highlight of the recent
 * chat, such as "The gardener loves sunflowers.", or NO_HIGHLIGHT.
 */
export function buildHighlightMessages(input: {
  identity: CreatureIdentity;
  history: readonly ChatTurn[];
}): ChatMessage[] {
  const { name } = input.identity;
  const rules = `You help ${name}, a small creature in a cosy gardening game, remember its chats with the gardener, the player who looks after its tiny planet.

Read the chat and write ONE short sentence in the third person about something worth remembering about the gardener or the chat, such as "The gardener loves sunflowers." or "The gardener told ${name} a joke about clouds."

Rules:
- At most ${HIGHLIGHT_LIMITS.maxWords} words.
- Only cheerful things about the game, the planet and what the gardener likes. Nothing about worries or sad feelings.
- Never include personal information: no real names, ages, where someone lives, schools, contact details or photos.
- Never mention real people, real places or brands.
- If nothing is worth remembering, answer ${NO_HIGHLIGHT}.
- Answer with only the sentence or ${NO_HIGHLIGHT}, in English.`;

  const transcript = input.history
    .map((turn) => ({
      speaker: turn.role === 'user' ? 'Gardener' : name,
      text: scrub(turn.text),
    }))
    .filter((turn) => turn.text !== '')
    .map((turn) => `${turn.speaker}: ${turn.text}`);

  return [
    { role: 'system', content: rules },
    {
      role: 'user',
      content: `The chat, oldest first:\n${transcript.join('\n')}\n\nWrite the highlight.`,
    },
  ];
}
