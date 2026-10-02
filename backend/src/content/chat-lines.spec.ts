import { checkText } from '../ai/content-rules';
import {
  CHAT_LINES,
  GREETINGS,
  greetingFor,
  kindLine,
  napLine,
  sleepyLine,
  waitingLine,
} from './chat-lines';
import { SPECIES } from './species';

/** A picker that always takes the item at this index. */
function pickAt(index: number) {
  return { pick: <T>(items: readonly T[]): T => items[index] };
}

describe('chat lines (CHT-01, CHT-03, AIB-03, AIB-05)', () => {
  it('has a few greetings for every species, each naming the creature', () => {
    for (const species of SPECIES) {
      const lines = GREETINGS[species.id];
      expect(lines.length).toBeGreaterThanOrEqual(3);
      for (const line of lines) {
        expect([line, line.includes('{name}')]).toEqual([line, true]);
      }
    }
  });

  it('keeps every line, with a name filled in, short and within the content rules', () => {
    const lines = [
      ...SPECIES.flatMap((species) =>
        GREETINGS[species.id].map((_, index) =>
          greetingFor(species.id, 'Wigglenut', pickAt(index)),
        ),
      ),
      waitingLine('Wigglenut'),
      napLine('Wigglenut'),
      sleepyLine('Wigglenut'),
      kindLine('Wigglenut'),
    ];
    for (const line of lines) {
      expect([
        line,
        checkText(line, { maxSentences: 3, maxWords: 25 }),
      ]).toEqual([line, []]);
      expect(line).toContain('Wigglenut');
      expect(line).not.toContain('{name}');
    }
  });

  it('picks a greeting through the random source, or the first without one', () => {
    expect(greetingFor('frog', 'Pip', pickAt(2))).toBe(
      'Hi there! Pip just did a little hop of joy.',
    );
    expect(greetingFor('frog', 'Pip')).toBe(
      'Ribbit! Hello, gardener! Pip hopped right over.',
    );
  });

  it('fills in the shared lines', () => {
    expect(waitingLine('Mira')).toBe('Mira is clearing their throat…');
    expect(napLine('Mira')).toBe(
      'Mira has dozed off mid-thought. Try again in a bit.',
    );
    expect(sleepyLine('Mira')).toBe(
      'Mmm… Mira is getting very sleepy. Come back tomorrow for more chatter?',
    );
    expect(kindLine('Mira')).toContain(
      "I'm really glad you told me. You matter to me, and talking to someone you trust can help.",
    );
  });

  it('speaks of a creature as they, never he or she', () => {
    const templates = [
      ...Object.values(GREETINGS).flat(),
      ...Object.values(CHAT_LINES),
    ];
    for (const template of templates) {
      expect([template, /\b(he|she|his|her|him)\b/i.test(template)]).toEqual([
        template,
        false,
      ]);
    }
  });

  it('keeps a name with special characters as it is', () => {
    expect(napLine('$& Bo')).toBe(
      '$& Bo has dozed off mid-thought. Try again in a bit.',
    );
  });
});
