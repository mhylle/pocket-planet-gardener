import { BLOCKED_WORDS } from '../content/blocked-words';
import {
  nameErrorMessage,
  normaliseForMatching,
  validateName,
} from './name-rules';

const planet = { min: 2, max: 24 };
const creature = { min: 1, max: 20 };
const sprout = '\u{1F331}'; // one emoji, two UTF-16 code units

describe('validateName', () => {
  describe('length', () => {
    it('accepts a name at the minimum length', () => {
      expect(validateName('Mo', planet)).toBe('ok');
    });

    it('rejects a name below the minimum length', () => {
      expect(validateName('M', planet)).toBe('too-short');
    });

    it('accepts a name at the maximum length', () => {
      expect(validateName('a'.repeat(24), planet)).toBe('ok');
    });

    it('rejects a name above the maximum length', () => {
      expect(validateName('a'.repeat(25), planet)).toBe('too-long');
    });

    it('treats an empty or whitespace-only name as too short', () => {
      expect(validateName('   \t ', planet)).toBe('too-short');
      expect(validateName('', creature)).toBe('too-short');
    });

    it('trims surrounding whitespace before checking', () => {
      expect(validateName('  M  ', planet)).toBe('too-short');
      expect(validateName(`  ${'a'.repeat(24)}  `, planet)).toBe('ok');
    });

    it('counts an emoji as one character', () => {
      expect(validateName(sprout, planet)).toBe('too-short');
      expect(validateName(sprout.repeat(24), planet)).toBe('ok');
      expect(validateName(sprout.repeat(25), planet)).toBe('too-long');
    });
  });

  describe('offensive words', () => {
    it('rejects a listed word, alone or inside a longer name', () => {
      expect(validateName('shit', planet)).toBe('offensive');
      expect(validateName('Little shit planet', planet)).toBe('offensive');
    });

    it('rejects every word on the default list', () => {
      const missed = BLOCKED_WORDS.filter(
        (word) => validateName(word, { min: 1, max: 50 }) !== 'offensive',
      );
      expect(missed).toEqual([]);
    });

    it('rejects l33t variants', () => {
      expect(validateName('5h1t', planet)).toBe('offensive');
      expect(validateName('B1tch Planet', planet)).toBe('offensive');
      expect(validateName('@$$', planet)).toBe('offensive');
    });

    it('rejects upper-case and repeated-letter variants', () => {
      expect(validateName('SHIT', planet)).toBe('offensive');
      expect(validateName('Shiiiiit', planet)).toBe('offensive');
      expect(validateName('FFUUUCCK', planet)).toBe('offensive');
    });

    it('rejects a variant with diacritics', () => {
      expect(validateName('Shït', planet)).toBe('offensive');
    });

    it('rejects a plural', () => {
      expect(validateName('Shits Galore', planet)).toBe('offensive');
    });

    it('rejects a listed word next to a digit', () => {
      expect(validateName('shit1', planet)).toBe('offensive');
    });

    it('rejects a word typed letter by letter with separators', () => {
      expect(validateName('s.h.i.t', planet)).toBe('offensive');
      expect(validateName('S H I T planet', planet)).toBe('offensive');
    });

    it.each([
      ['Scunthorpe', 'cunt'],
      ['Sussex', 'sex'],
      ['Classic Glass', 'ass'],
      ['Shiitake Hill', 'shit'],
      ['Penistone', 'penis'],
      ['Grape Garden', 'rape'],
      ['Cocktail Cove', 'cock'],
    ])(
      'accepts %s, an innocent word containing a listed one',
      (name, inner) => {
        expect(BLOCKED_WORDS).toContain(inner);
        expect(validateName(name, planet)).toBe('ok');
      },
    );

    it('does not shrink a doubled letter into a shorter innocent word', () => {
      expect(validateName('As Above', planet)).toBe('ok');
    });
  });

  describe('with a custom list', () => {
    it('matches the given words instead of the default list', () => {
      expect(validateName('Bad Moon', planet, ['moon'])).toBe('offensive');
      expect(validateName('shit', planet, ['moon'])).toBe('ok');
    });

    it('lets letters repeat but never shrink', () => {
      expect(validateName('Mooooon', planet, ['moon'])).toBe('offensive');
      expect(validateName('Mon Ami', planet, ['moon'])).toBe('ok');
    });

    it('matches a phrase across any separator or none', () => {
      for (const name of ['Donald Duck', 'donald-duck', 'DonaldDuck']) {
        expect(validateName(name, planet, ['donald duck'])).toBe('offensive');
      }
    });

    it('accepts any name when the list is empty', () => {
      expect(validateName('Mars 2', planet, [])).toBe('ok');
    });
  });
});

describe('normaliseForMatching', () => {
  it('lower-cases, strips diacritics and undoes l33t', () => {
    expect(normaliseForMatching('Gärd3n')).toBe('garden');
    expect(normaliseForMatching('$T@R')).toBe('star');
    expect(normaliseForMatching('M00N 4 7')).toBe('moon a t');
  });
});

describe('nameErrorMessage', () => {
  it('mentions the minimum for a short name', () => {
    expect(nameErrorMessage('too-short', planet, 'Planet')).toBe(
      'Planet names need at least 2 characters.',
    );
  });

  it('mentions the maximum for a long name', () => {
    expect(nameErrorMessage('too-long', planet, 'Planet')).toBe(
      'Planet names can be at most 24 characters.',
    );
  });

  it('uses the singular for a one-character limit', () => {
    expect(nameErrorMessage('too-short', creature, 'Creature')).toBe(
      'Creature names need at least 1 character.',
    );
  });

  it('gives a gentle message for an offensive name', () => {
    expect(nameErrorMessage('offensive', planet, 'Planet')).toBe(
      "That name isn't very cosy. How about another?",
    );
  });
});
