import { BLOCKED_NAMES } from '../content/blocked-names';
import { BLOCKED_WORDS } from '../content/blocked-words';
import { GUILT_PHRASES } from '../content/guilt-phrases';
import { SENSITIVE_TERMS } from '../content/sensitive-terms';
import {
  NAMES_THAT_ARE_EVERYDAY_WORDS,
  PERSONAL_INFO_REQUESTS,
  REAL_BEING_CLAIMS,
} from '../content/tone-phrases';
import { validateName } from '../planets/name-rules';

/** One way a text breaks the content and tone rules (SD section 10, AIB-01). */
export type Violation =
  | 'banned-term'
  | 'sensitive-topic'
  | 'guilt-trip'
  | 'url-or-email'
  | 'personal-info-request'
  | 'claims-to-be-real'
  | 'famous-name'
  | 'too-long'
  | 'too-many-sentences'
  | 'empty';

/** Length limits for one kind of text, such as a chat answer; absent means none. */
export interface TextLimits {
  maxWords?: number;
  maxSentences?: number;
}

/** Famous names as free text may not mention them, without everyday words such as "goofy". */
const FAMOUS_NAMES = BLOCKED_NAMES.filter(
  (name) => !NAMES_THAT_ARE_EVERYDAY_WORDS.includes(name),
);

/** Any length, so that validateName only looks for listed words. */
const ANY_LENGTH = { min: 0, max: Number.POSITIVE_INFINITY };

/** A link, or an email address or handle: anything pointing off the planet. */
const URL_OR_EMAIL =
  /https?:\/\/|\bwww\.|@[\w-]|\b[\w-]+\.(?:com|net|org|io|dk|uk|de|info|app|gg|tv)\b/i;

/** End marks, an ellipsis among them, then any closing quote or bracket, then a space or the end. */
const SENTENCE_END = /[.!?…]+["'’”)\]]*(?=\s|$)/u;

/** A word holds at least one letter or digit, so a lone dash or emoji is not one. */
const WORDLIKE = /[\p{L}\p{N}]/u;

/**
 * True when the text holds a listed word or phrase as a whole word, matched
 * the way names are (name-rules): ignoring case, diacritics, l33t and
 * repeated letters, so "Scunthorpe" does not match "cunt".
 */
function mentionsAny(text: string, phrases: readonly string[]): boolean {
  return validateName(text, ANY_LENGTH, phrases) === 'offensive';
}

/** The word-level rules in report order. */
const RULES: readonly [Violation, (text: string) => boolean][] = [
  ['banned-term', (text) => mentionsAny(text, BLOCKED_WORDS)],
  ['sensitive-topic', (text) => mentionsAny(text, SENSITIVE_TERMS)],
  ['guilt-trip', (text) => mentionsAny(text, GUILT_PHRASES)],
  ['url-or-email', (text) => URL_OR_EMAIL.test(text)],
  [
    'personal-info-request',
    (text) => mentionsAny(text, PERSONAL_INFO_REQUESTS),
  ],
  ['claims-to-be-real', (text) => mentionsAny(text, REAL_BEING_CLAIMS)],
  ['famous-name', (text) => mentionsAny(text, FAMOUS_NAMES)],
];

/** Whitespace-separated words, so "lamp-post" is one word. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => WORDLIKE.test(token)).length;
}

/** Sentences ended by . ! ? or an ellipsis; text after the last end mark counts as one more. */
export function sentenceCount(text: string): number {
  return text.split(SENTENCE_END).filter((part) => WORDLIKE.test(part)).length;
}

/**
 * Every rule the text breaks, each once and in the order Violation lists
 * them; [] means it may be shown (AIB-01 AC2). A text without words is only
 * 'empty'.
 */
export function checkText(text: string, limits: TextLimits = {}): Violation[] {
  if (wordCount(text) === 0) return ['empty'];
  const violations = RULES.filter(([, breaks]) => breaks(text)).map(
    ([violation]) => violation,
  );
  if (limits.maxWords !== undefined && wordCount(text) > limits.maxWords) {
    violations.push('too-long');
  }
  if (
    limits.maxSentences !== undefined &&
    sentenceCount(text) > limits.maxSentences
  ) {
    violations.push('too-many-sentences');
  }
  return violations;
}
