import { checkText } from '../ai/content-rules';
import { SPECIES } from './species';
import { THANK_YOU_LINES } from './thank-you-lines';

describe('thank-you lines (WNT-03 AC1)', () => {
  it('has a few lines for every species', () => {
    for (const species of SPECIES) {
      expect(THANK_YOU_LINES[species.id].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every line short and within the content rules', () => {
    for (const lines of Object.values(THANK_YOU_LINES)) {
      for (const line of lines) {
        expect([
          line,
          checkText(line, { maxSentences: 2, maxWords: 15 }),
        ]).toEqual([line, []]);
      }
    }
  });

  it('says thank you in every line', () => {
    for (const lines of Object.values(THANK_YOU_LINES)) {
      for (const line of lines) {
        expect(line).toMatch(/thank you/i);
      }
    }
  });
});
