import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkText } from '../ai/content-rules';
import { HELPLINE_LABEL, WELLBEING_NOTICE } from '../chat/chat.service';
import {
  TEMPLATE_MAX_WORDS,
  templateEntry,
  type JournalEvent,
} from '../journal/journal-fact-check';
import { SPECIES } from './species';

// The tone review of all scripted text (NFR-11, Task 17.5): every string
// any content module exports is held to the content rules (SD section 10),
// found by walking the exports, so new content is covered without being
// listed here. Length limits per kind of text stay with each module's spec.

// Jest runs from backend/, so the path starts there.
const CONTENT_DIR = join('src', 'content');

/**
 * The lists checkText itself matches against, and the wellbeing detector's:
 * they hold the very words the rules flag, and no player reads them.
 */
const RULE_LISTS = [
  'blocked-names.ts',
  'blocked-words.ts',
  'guilt-phrases.ts',
  'sensitive-terms.ts',
  'tone-phrases.ts',
  'wellbeing-phrases.ts',
];

/** One exported string and where it sits, such as "plants.ts PLANTS[0].description". */
interface FoundText {
  at: string;
  text: string;
}

/** Every string in the value, however deeply nested in arrays and objects. */
function stringsIn(value: unknown, at: string): FoundText[] {
  if (typeof value === 'string') {
    return [{ at, text: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => stringsIn(item, `${at}[${i}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      stringsIn(item, `${at}.${key}`),
    );
  }
  return [];
}

const modules = readdirSync(CONTENT_DIR).filter(
  (file) =>
    file.endsWith('.ts') &&
    !file.endsWith('.spec.ts') &&
    // Types only: nothing to walk at run time.
    !file.endsWith('.types.ts'),
);

/** The module's exports. */
function load(file: string): Promise<Record<string, unknown>> {
  return import(resolve(CONTENT_DIR, file)) as Promise<Record<string, unknown>>;
}

/** A violation-free text reads as []; anything else names the text. */
function violationsOf({ at, text }: FoundText, maxWords?: number) {
  return { at, text, violations: checkText(text, { maxWords }) };
}

describe('tone review of scripted text (NFR-11)', () => {
  it('finds the content modules', () => {
    expect(modules).toEqual(
      expect.arrayContaining(['plants.ts', 'tutorial.ts', ...RULE_LISTS]),
    );
  });

  it.each(modules.filter((file) => !RULE_LISTS.includes(file)))(
    'keeps every string %s exports within the content rules',
    async (file) => {
      const found = Object.entries(await load(file)).flatMap(([name, value]) =>
        stringsIn(value, `${file} ${name}`),
      );

      expect(found.length).toBeGreaterThan(0);
      for (const text of found) {
        expect(violationsOf(text)).toEqual({ ...text, violations: [] });
      }
    },
  );

  it.each(RULE_LISTS)(
    'finds only lists of words in the rule list %s, so no player text hides there',
    async (file) => {
      for (const [name, value] of Object.entries(await load(file))) {
        expect([
          name,
          Array.isArray(value) &&
            value.every((item) => typeof item === 'string'),
        ]).toEqual([name, true]);
      }
    },
  );

  it('keeps the wellbeing notice within the content rules', () => {
    for (const text of [WELLBEING_NOTICE, HELPLINE_LABEL]) {
      const found = { at: 'chat.service.ts', text };
      expect(violationsOf(found)).toEqual({ ...found, violations: [] });
    }
  });

  it('keeps every wording of the journal template within the content rules', () => {
    const named = (type: string, payload: Record<string, unknown> = {}) =>
      ({ type, payload }) satisfies JournalEvent;
    const busyDays: JournalEvent[][] = [
      [named('plant-bloomed', { type: 'sunflower' })],
      [
        ...['clover', 'clover', 'clover', 'tulip'].map((type) =>
          named('plant-bloomed', { type }),
        ),
      ],
      SPECIES.map((species) =>
        named('creature-arrived', { species: species.id, name: 'Mira' }),
      ),
      [named('creature-arrived', { species: 'snail' })],
      [named('want-fulfilled', { name: 'Mira' }), named('want-fulfilled')],
      [named('gift-received', { name: 'Mira' }), named('gift-received')],
    ];
    // Each value picks a different wording from lists of two or three.
    const picks = [0, 0.34, 0.67, 0.99];
    const date = new Date('2030-01-01T00:00:00.000Z');

    for (const creatureNames of [[], ['Wigglenut']]) {
      for (const events of [[], ...busyDays]) {
        for (const pick of picks) {
          const text = templateEntry(
            events,
            {
              events,
              creatureNames,
              planetName: 'Moonbeam',
              maxWords: TEMPLATE_MAX_WORDS,
            },
            date,
            () => pick,
          );
          const found = { at: 'journal template', text };
          expect(violationsOf(found, TEMPLATE_MAX_WORDS)).toEqual({
            ...found,
            violations: [],
          });
        }
      }
    }
  });
});
