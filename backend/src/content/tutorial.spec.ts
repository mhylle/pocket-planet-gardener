import { checkText } from '../ai/content-rules';
import { TUTORIAL_STEPS, type TutorialHighlight } from './tutorial';

const HIGHLIGHTS: readonly TutorialHighlight[] = [
  'canvas',
  'inventory',
  'sky',
  'card',
  'none',
];

describe("Pip's tutorial (ONB-01)", () => {
  it('has the 8 steps in order, each id once', () => {
    const ids = TUTORIAL_STEPS.map((step) => step.id);

    expect(ids).toEqual([
      'welcome',
      'rotate',
      'open-inventory',
      'plant',
      'water',
      'move-sun',
      'inspect',
      'goodbye',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every line to at most 2 sentences and within the content rules', () => {
    for (const { text } of TUTORIAL_STEPS) {
      expect([
        text,
        checkText(text, { maxSentences: 2, maxWords: 30 }),
      ]).toEqual([text, []]);
    }
  });

  it('points every step at a known part of the screen', () => {
    for (const { id, highlight } of TUTORIAL_STEPS) {
      expect([id, HIGHLIGHTS.includes(highlight)]).toEqual([id, true]);
    }
  });
});
