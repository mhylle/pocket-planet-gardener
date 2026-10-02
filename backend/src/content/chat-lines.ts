import type { RandomService } from '../common/random.service';
import type { SpeciesId } from './content.types';

// Scripted chat lines that never wait for the model (CHT-01, CHT-03,
// AIB-03, AIB-05). {name} stands for the creature's name; the lines speak
// of a creature as they/their. chat-lines.spec.ts holds them to the
// content rules.

/** How a creature greets the gardener when the chat opens, in its species' voice (CHT-01 AC1). */
export const GREETINGS: Readonly<Record<SpeciesId, readonly string[]>> = {
  worm: [
    'Oh, hello! {name} here, wiggling up from the soil to say hi.',
    'Hi there, gardener! {name} has dusted off the dirt just for you.',
    'Hello, hello! {name} is all ears. Well, worms have no ears, but you know.',
  ],
  snail: [
    'Oh, hello there. {name} has arrived, slowly but surely.',
    'Good day, gardener. {name} is in no hurry, so let us chat.',
    'Hello! {name} pokes out two wobbly eye-stalks to say hi.',
  ],
  bee: [
    'Bzz, hello! {name} buzzed over as fast as wings allow.',
    'Hi, gardener! {name} is humming with things to say.',
    'Oh, a visitor! {name} has pollen to spare and time to chat.',
  ],
  moth: [
    'Ah, hello. {name} flutters down softly for a chat.',
    'Good evening, gardener. Or is it day? {name} never quite knows.',
    'Oh, how lovely. {name} has been dreaming of a little chat.',
  ],
  hedgehog: [
    'Snuffle snuffle! Oh, hello! {name} is here.',
    'Hi there, gardener! {name} uncurls just for you.',
    'Oh! Hello! {name} was snuffling about, but chatting is better.',
  ],
  frog: [
    'Ribbit! Hello, gardener! {name} hopped right over.',
    'Oh, hello! {name} has a fresh croak ready just for you.',
    'Hi there! {name} just did a little hop of joy.',
  ],
};

/** The lines every species shares. */
export const CHAT_LINES = {
  // Shown while the answer is on its way (CHT-01 AC3).
  waiting: '{name} is clearing their throat…',
  // The answer when the model is down, slow or off (CHT-01 AC4, AIB-05).
  nap: '{name} has dozed off mid-thought. Try again in a bit.',
  // The answer once today's messages are used up (CHT-03 AC1).
  sleepy:
    'Mmm… {name} is getting very sleepy. Come back tomorrow for more chatter?',
  // The answer to a player in danger when the model fails (AIB-03 AC2).
  kind: '{name} listens closely. "I\'m really glad you told me. You matter to me, and talking to someone you trust can help."',
} as const;

function withName(template: string, name: string): string {
  return template.split('{name}').join(name);
}

/** A greeting for a creature of this species; the first one when no random source is given. */
export function greetingFor(
  species: SpeciesId,
  name: string,
  rng?: Pick<RandomService, 'pick'>,
): string {
  const lines = GREETINGS[species];
  return withName(rng ? rng.pick(lines) : lines[0], name);
}

export function waitingLine(name: string): string {
  return withName(CHAT_LINES.waiting, name);
}

export function napLine(name: string): string {
  return withName(CHAT_LINES.nap, name);
}

export function sleepyLine(name: string): string {
  return withName(CHAT_LINES.sleepy, name);
}

export function kindLine(name: string): string {
  return withName(CHAT_LINES.kind, name);
}
