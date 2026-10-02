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
 * True when the text holds a banned word, matched the way names are
 * (name-rules): ignoring case, diacritics, l33t and repeated letters, so a
 * disguised spelling is caught while "Scunthorpe" still passes. Only banned
 * words get this tolerance: for ordinary terms it turns "good" into "god".
 */
function mentionsDisguised(text: string, words: readonly string[]): boolean {
  return validateName(text, ANY_LENGTH, words) === 'offensive';
}

/** Lower-cased, without diacritics, every run of other characters one space, padded with spaces. */
function asWords(text: string): string {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return ` ${words} `;
}

/**
 * True when the text holds a listed word or phrase as whole words, spelled
 * exactly (case, diacritics and punctuation aside; a plural "s" allowed). A
 * phrase also matches written as one word, so "DonaldDuck" is "donald duck".
 */
function mentionsExactly(text: string, phrases: readonly string[]): boolean {
  const words = asWords(text);
  return phrases.some((phrase) => {
    const listed = asWords(phrase).trim();
    const joined = listed.replace(/ /g, '');
    return [listed, joined].some(
      (form) => words.includes(` ${form} `) || words.includes(` ${form}s `),
    );
  });
}

/** The word-level rules in report order. */
const RULES: readonly [Violation, (text: string) => boolean][] = [
  ['banned-term', (text) => mentionsDisguised(text, BLOCKED_WORDS)],
  ['sensitive-topic', (text) => mentionsExactly(text, SENSITIVE_TERMS)],
  ['guilt-trip', (text) => mentionsExactly(text, GUILT_PHRASES)],
  ['url-or-email', (text) => URL_OR_EMAIL.test(text)],
  [
    'personal-info-request',
    (text) => mentionsExactly(text, PERSONAL_INFO_REQUESTS),
  ],
  ['claims-to-be-real', (text) => mentionsExactly(text, REAL_BEING_CLAIMS)],
  ['famous-name', (text) => mentionsExactly(text, FAMOUS_NAMES)],
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
