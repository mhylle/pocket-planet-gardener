import {
  DANGER_PHRASES,
  LINKING_WORDS,
  PLANET_WORDS,
  SAD_PHRASES,
} from '../content/wellbeing-phrases';

// Spotting a player who is having a hard time in chat (AIB-03). Phrases
// match exactly as whole words, as the content rules match sensitive terms,
// never with the disguised-spelling tolerance that turns "good" into "god".

/** How a player's chat message sounds: fine, sad or stressed, or in danger. */
export type Distress = 'none' | 'sad' | 'danger';

/** Where a phrase was found in a list of words; end is exclusive. */
interface Match {
  start: number;
  end: number;
}

/**
 * Lower-cased words without diacritics, split on everything that is not a
 * letter or a digit as content-rules does. Apostrophes are dropped instead,
 * so "I'm" and "Im" are the same word.
 */
function toWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['‘’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

const DANGER = DANGER_PHRASES.map(toWords);
const SAD = SAD_PHRASES.map(toWords);
const LINKING = new Set(LINKING_WORDS);
const PLANET = new Set(PLANET_WORDS);

/** Every place the phrase occurs as whole words, or run together as one word. */
function matches(words: readonly string[], phrase: readonly string[]): Match[] {
  const joined = phrase.join('');
  const found: Match[] = [];
  for (let start = 0; start < words.length; start++) {
    if (phrase.every((word, offset) => words[start + offset] === word)) {
      found.push({ start, end: start + phrase.length });
    } else if (phrase.length > 1 && words[start] === joined) {
      found.push({ start, end: start + 1 });
    }
  }
  return found;
}

function isPlanetWord(word: string | undefined): boolean {
  if (word === undefined) return false;
  return (
    PLANET.has(word) || (word.endsWith('s') && PLANET.has(word.slice(0, -1)))
  );
}

/**
 * True when a sad phrase is about something on the planet: a planet word
 * comes before or after it, perhaps with linking words between ("the
 * sunflower looks sad", "a lonely little snail").
 */
function isAboutPlanet(words: readonly string[], match: Match): boolean {
  let before = match.start - 1;
  while (before >= 0 && LINKING.has(words[before])) before--;
  let after = match.end;
  while (after < words.length && LINKING.has(words[after])) after++;
  return isPlanetWord(words[before]) || isPlanetWord(words[after]);
}

/**
 * Whether a chat message suggests the player is in danger, sad or stressed,
 * or neither (AIB-03). Danger wins over sad; a sad phrase about a plant or
 * a creature does not count.
 */
export function detectDistress(text: string): Distress {
  const words = toWords(text);
  if (DANGER.some((phrase) => matches(words, phrase).length > 0)) {
    return 'danger';
  }
  const sad = SAD.some((phrase) =>
    matches(words, phrase).some((match) => !isAboutPlanet(words, match)),
  );
  return sad ? 'sad' : 'none';
}
