import { BLOCKED_WORDS } from '../content/blocked-words';

/** Outcome of checking a planet or creature name (SD ACC-02, CRT-06). */
export type NameCheck = 'ok' | 'too-short' | 'too-long' | 'offensive';

/** Inclusive length bounds, counted in user-perceived characters. */
export interface NameLimits {
  min: number;
  max: number;
}

/** Digits and symbols commonly typed in place of letters. */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** Any run of characters that are not letters, including none at all. */
const SEPARATORS = '[^\\p{L}]*';

/** Lower-cases and strips diacritics, so that "Fück" reads as "fuck". */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

/** Folds the text and undoes l33t substitutions, so that "M00N" reads as "moon". */
export function normaliseForMatching(text: string): string {
  return [...fold(text)].map((char) => LEET[char] ?? char).join('');
}

/** Joins letters typed one at a time, so that "m.o.o.n" reads as "moon". */
function joinSpacedLetters(text: string): string {
  return text.replace(/(?<!\p{L})\p{L}(?:[^\p{L}]+\p{L}(?!\p{L}))+/gu, (run) =>
    run.replace(/[^\p{L}]/gu, ''),
  );
}

/**
 * Pattern for one blocked word. A letter may repeat but never shrinks, so
 * "moon" matches "mooooon" but not "mon". A non-letter in a phrase such as
 * "donald duck" matches any separator, or none.
 */
function wordPattern(word: string): string {
  const runs = normaliseForMatching(word).match(/(.)\1*/gu) ?? [];
  return runs
    .map((run) => {
      const chars = [...run];
      if (!/\p{L}/u.test(chars[0])) return SEPARATORS;
      return chars.length === 1
        ? `${chars[0]}+`
        : `${chars[0]}{${chars.length},}`;
    })
    .join('');
}

/**
 * Matches a blocked word only as a whole word (optionally plural), so an
 * innocent word that merely contains one, such as "Scunthorpe", passes.
 */
function blockedPattern(blocked: readonly string[]): RegExp | null {
  const words = blocked
    .filter((word) => /\p{L}/u.test(normaliseForMatching(word)))
    .map(wordPattern);
  if (words.length === 0) return null;
  return new RegExp(`(?<!\\p{L})(?:${words.join('|')})s*(?!\\p{L})`, 'u');
}

/**
 * Checks a name after trimming it. Length counts code points, so an emoji
 * counts once. Callers should store the trimmed name.
 */
export function validateName(
  name: string,
  limits: NameLimits,
  blocked: readonly string[] = BLOCKED_WORDS,
): NameCheck {
  const trimmed = name.trim();
  const length = [...trimmed].length;
  if (length < limits.min) return 'too-short';
  if (length > limits.max) return 'too-long';

  const pattern = blockedPattern(blocked);
  if (!pattern) return 'ok';
  // The folded form keeps digits as separators, so "shit1" is still caught.
  const forms = [fold(trimmed), normaliseForMatching(trimmed)];
  const offensive = forms.some(
    (form) => pattern.test(form) || pattern.test(joinSpacedLetters(form)),
  );
  return offensive ? 'offensive' : 'ok';
}

/** Friendly, all-ages message for a rejected name; subject is e.g. "Planet". */
export function nameErrorMessage(
  check: Exclude<NameCheck, 'ok'>,
  limits: NameLimits,
  subject: string,
): string {
  switch (check) {
    case 'too-short':
      return `${subject} names need at least ${characters(limits.min)}.`;
    case 'too-long':
      return `${subject} names can be at most ${characters(limits.max)}.`;
    case 'offensive':
      return "That name isn't very cosy. How about another?";
  }
}

function characters(count: number): string {
  return count === 1 ? '1 character' : `${count} characters`;
}
