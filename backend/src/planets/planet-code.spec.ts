import { SeededRandom } from '../../test/support/seeded-random';
import {
  generatePlanetCode,
  isPlanetCode,
  normalisePlanetCode,
  PLANET_CODE_ALPHABET,
} from './planet-code';

describe('planet codes', () => {
  describe('PLANET_CODE_ALPHABET', () => {
    it('leaves out the characters that are easy to confuse', () => {
      for (const char of ['0', 'O', '1', 'I', 'L']) {
        expect(PLANET_CODE_ALPHABET).not.toContain(char);
      }
    });

    it('holds each character once', () => {
      expect(new Set(PLANET_CODE_ALPHABET).size).toBe(
        PLANET_CODE_ALPHABET.length,
      );
    });
  });

  describe('generatePlanetCode', () => {
    it('makes 8 characters from the alphabet only', () => {
      const random = new SeededRandom(42);

      for (let i = 0; i < 200; i++) {
        const code = generatePlanetCode(random);

        expect(code).toHaveLength(8);
        for (const char of code) {
          expect(PLANET_CODE_ALPHABET).toContain(char);
        }
      }
    });

    it('can draw the first and the last character of the alphabet', () => {
      const first = generatePlanetCode({ int: (min) => min });
      const last = generatePlanetCode({ int: (_min, max) => max });

      expect(first).toBe('AAAAAAAA');
      expect(last).toBe('99999999');
    });

    it('repeats for the same seed', () => {
      expect(generatePlanetCode(new SeededRandom(7))).toBe(
        generatePlanetCode(new SeededRandom(7)),
      );
    });

    it('differs between seeds', () => {
      expect(generatePlanetCode(new SeededRandom(7))).not.toBe(
        generatePlanetCode(new SeededRandom(8)),
      );
    });
  });

  describe('normalisePlanetCode', () => {
    it('upper-cases a lower-case code', () => {
      expect(normalisePlanetCode('abcd2345')).toBe('ABCD2345');
    });

    it('trims surrounding spaces', () => {
      expect(normalisePlanetCode('  aBcD2345 \n')).toBe('ABCD2345');
    });
  });

  describe('isPlanetCode', () => {
    it('accepts a generated code', () => {
      expect(isPlanetCode(generatePlanetCode(new SeededRandom(3)))).toBe(true);
    });

    it('accepts a lower-case code once it is normalised', () => {
      expect(isPlanetCode('abcd2345')).toBe(false);
      expect(isPlanetCode(normalisePlanetCode(' abcd2345 '))).toBe(true);
    });

    it.each(['ABCD234', 'ABCD23456', '', 'ABCD 345'])(
      'rejects %p for its length or spacing',
      (code) => {
        expect(isPlanetCode(code)).toBe(false);
      },
    );

    it.each(['ABCD234O', 'ABCD2340', 'ABCD2341', 'ABCD234I', 'ABCD234L'])(
      'rejects %p for a character outside the alphabet',
      (code) => {
        expect(isPlanetCode(code)).toBe(false);
      },
    );
  });
});
