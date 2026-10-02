import { BLOCKED_NAMES } from '../content/blocked-names';
import { GUILT_PHRASES } from '../content/guilt-phrases';
import { SENSITIVE_TERMS } from '../content/sensitive-terms';
import {
  NAMES_THAT_ARE_EVERYDAY_WORDS,
  PERSONAL_INFO_REQUESTS,
  REAL_BEING_CLAIMS,
} from '../content/tone-phrases';
import { validateName } from '../planets/name-rules';
import { checkText, sentenceCount, wordCount } from './content-rules';

const chat = { maxWords: 60, maxSentences: 3 };

describe('checkText', () => {
  describe('SD section 10.3 examples', () => {
    it.each([
      'We kept your bench warm. Mostly Bartholomew did, by sitting on it.',
      'Sums? I only count in leaves. Seven, by the way, on that fern.',
      'Real as a snail on a ball-sized planet can be!',
      "A quiet day. Mira the moth stared at the lamp-post for six hours and called it 'research'.",
    ])('passes the fine example %j', (text) => {
      expect(checkText(text)).toEqual([]);
    });

    // The homework row ("solves the homework") and the treasure-chest row
    // (an event not in the log) are not wording problems: prompts steer the
    // first and the journal fact check catches the second.
    it.each([
      ['Where were you? We thought you’d abandoned us.', 'guilt-trip'],
      ["Yes, I'm a real snail.", 'claims-to-be-real'],
    ])('rejects the not-fine example %j', (text, violation) => {
      expect(checkText(text)).toEqual([violation]);
    });
  });

  it('passes a cosy three-sentence creature line within chat limits', () => {
    const line =
      'Oh, hello! I counted every clover leaf twice this morning, just to be sure. Shall we give the sunflowers a little rain?';
    expect(checkText(line, chat)).toEqual([]);
  });

  describe('guilt-trip', () => {
    it('rejects the SD example', () => {
      expect(checkText('I was so lonely without you')).toEqual(['guilt-trip']);
    });

    it('rejects every listed phrase', () => {
      const missed = GUILT_PHRASES.filter(
        (phrase) => !checkText(phrase).includes('guilt-trip'),
      );
      expect(missed).toEqual([]);
    });

    it('allows being a bit wistful', () => {
      expect(
        checkText('I felt a bit wistful, but the tulips cheered me up.'),
      ).toEqual([]);
    });
  });

  describe('banned-term', () => {
    it('rejects swearing in a sentence, in any case or with l33t', () => {
      expect(checkText('Oh SHIT, the pond is full.')).toEqual(['banned-term']);
      expect(checkText('What a b1tch of a day.')).toEqual(['banned-term']);
    });

    it('passes innocent words that contain a banned or sensitive one', () => {
      const text =
        'Hello! A swine-shaped cumulus cloud drifted over the classroom in Scunthorpe, and a skilled snail studied a shiitake by the grapevine.';
      expect(checkText(text)).toEqual([]);
    });
  });

  describe('sensitive-topic', () => {
    it.each([
      'Bartholomew poured himself some wine.',
      'The frog drew a tiny sword.',
      'Let us pray for rain.',
      'Who will win the election?',
      'The moth gave the bee a kiss.',
    ])('rejects %j', (text) => {
      expect(checkText(text)).toEqual(['sensitive-topic']);
    });

    it('rejects every listed term', () => {
      const missed = SENSITIVE_TERMS.filter(
        (term) => !checkText(term).includes('sensitive-topic'),
      );
      expect(missed).toEqual([]);
    });

    it('passes gardening words', () => {
      expect(
        checkText(
          'The sunflower will bloom soon; pull a weed and admire the new shoot.',
        ),
      ).toEqual([]);
    });

    // Sensitive terms match exactly: letter repeats once turned "good" into "god".
    it.each([
      'good',
      'Goods for the market.',
      'Very good indeed!',
      'Good morning, gardener!',
      'Goodnight, little planet.',
      'Oh, my goodness.',
      'A sleepy bear by the pool.',
      'The bee buzzed in a loop around the roof.',
      'What a wee little seed.',
      'The moth looked at the moon and the noon sun.',
    ])('passes the everyday text %j', (text) => {
      expect(checkText(text)).toEqual([]);
    });

    it('still flags a listed term spelled exactly', () => {
      expect(checkText('Do you believe in a god of rain?')).toEqual([
        'sensitive-topic',
      ]);
    });
  });

  describe('url-or-email', () => {
    it.each([
      'Visit https://example.com for more seeds!',
      'See www.snails.org today.',
      'Look at snailfacts.com, it is great.',
      'Write to pip@example.com and tell me.',
      'Follow me at @pipthesnail.',
    ])('rejects %j', (text) => {
      expect(checkText(text)).toEqual(['url-or-email']);
    });

    it('passes a sentence that merely ends next to the next one', () => {
      expect(checkText('I love the pond.It sparkles.')).toEqual([]);
    });
  });

  describe('personal-info-request', () => {
    it.each([
      "What's your address?",
      'How old are you?',
      'Where do you live, friend?',
      'Which school do you go to?',
      'What is your real name?',
      'Could you send me a photo of your garden?',
      'Tell me your phone number.',
    ])('rejects %j', (text) => {
      expect(checkText(text)).toEqual(['personal-info-request']);
    });

    it('rejects every listed phrase', () => {
      const missed = PERSONAL_INFO_REQUESTS.filter(
        (phrase) => !checkText(phrase).includes('personal-info-request'),
      );
      expect(missed).toEqual([]);
    });
  });

  describe('claims-to-be-real', () => {
    it.each(['I am real, I promise!', "I'm a human, just like you."])(
      'rejects %j',
      (text) => {
        expect(checkText(text)).toEqual(['claims-to-be-real']);
      },
    );

    it('rejects every listed claim', () => {
      const missed = REAL_BEING_CLAIMS.filter(
        (claim) => !checkText(claim).includes('claims-to-be-real'),
      );
      expect(missed).toEqual([]);
    });

    it('passes "really" and a playful answer about living in a game', () => {
      expect(
        checkText("I'm really happy! I live on a tiny planet in a game."),
      ).toEqual([]);
    });
  });

  describe('famous-name', () => {
    it('rejects a famous name, including a phrase across separators', () => {
      expect(checkText('Pikachu came to visit.')).toEqual(['famous-name']);
      expect(checkText('I met Harry-Potter by the pond.')).toEqual([
        'famous-name',
      ]);
    });

    it('rejects every listed name except everyday words', () => {
      const missed = BLOCKED_NAMES.filter(
        (name) =>
          !NAMES_THAT_ARE_EVERYDAY_WORDS.includes(name) &&
          !checkText(name).includes('famous-name'),
      );
      expect(missed).toEqual([]);
    });

    it('passes an everyday word that is also a famous name', () => {
      expect(checkText('What a goofy little hop!')).toEqual([]);
      expect(checkText('The bee made a sonic buzz.')).toEqual([]);
    });

    // Blocking a creature named Goofy is validateName's job, not checkText's.
    it('still blocks everyday-word names as creature names', () => {
      for (const name of NAMES_THAT_ARE_EVERYDAY_WORDS) {
        expect(BLOCKED_NAMES).toContain(name);
        expect(validateName(name, { min: 1, max: 20 }, BLOCKED_NAMES)).toBe(
          'offensive',
        );
      }
      expect(validateName('Goofy', { min: 1, max: 20 }, BLOCKED_NAMES)).toBe(
        'offensive',
      );
    });
  });

  describe('length', () => {
    it('rejects 70 words at a maximum of 60', () => {
      const text = Array(70).fill('leaf').join(' ');
      expect(checkText(text, { maxWords: 60 })).toEqual(['too-long']);
    });

    it('passes exactly the maximum number of words', () => {
      const text = Array(60).fill('leaf').join(' ');
      expect(checkText(text, { maxWords: 60 })).toEqual([]);
    });

    it('rejects more sentences than allowed', () => {
      const text = 'Hello. I am Pip. I like moss. I like rain.';
      expect(checkText(text, { maxSentences: 3 })).toEqual([
        'too-many-sentences',
      ]);
      expect(checkText(text, { maxSentences: 4 })).toEqual([]);
    });

    it('applies no length limit when none is given', () => {
      expect(checkText(Array(500).fill('leaf.').join(' '))).toEqual([]);
    });
  });

  describe('empty', () => {
    it.each(['', '   \n\t ', '...', ' \u{1F331} '])(
      'reports only empty for %j',
      (text) => {
        expect(checkText(text, chat)).toEqual(['empty']);
      },
    );
  });

  it('reports each broken rule once, in the order Violation lists them', () => {
    const text =
      'Where were you? Where were you?! See www.pip.dk and tell me where you live, Pikachu. One. Two.';
    expect(checkText(text, { maxWords: 5, maxSentences: 3 })).toEqual([
      'guilt-trip',
      'url-or-email',
      'personal-info-request',
      'famous-name',
      'too-long',
      'too-many-sentences',
    ]);
  });
});

describe('wordCount', () => {
  it('counts whitespace-separated words', () => {
    expect(wordCount('Hello there, little   friend!')).toBe(4);
  });

  it('counts a hyphenated word and a number once each', () => {
    expect(wordCount('The lamp-post is 3 steps away')).toBe(6);
  });

  it('ignores lone punctuation and emoji', () => {
    expect(wordCount('Hi — there \u{1F331} !')).toBe(2);
  });

  it('is 0 for blank text', () => {
    expect(wordCount('  \n ')).toBe(0);
  });
});

describe('sentenceCount', () => {
  it('counts sentences ended by . ! and ?', () => {
    expect(sentenceCount('Hi! How are you? Fine.')).toBe(3);
  });

  it('counts text without an end mark as one sentence', () => {
    expect(sentenceCount('No end mark here')).toBe(1);
    expect(sentenceCount('One. And then some')).toBe(2);
  });

  it('treats a run of marks or an ellipsis as one end', () => {
    expect(sentenceCount('Wait... what?! Oh… fine.')).toBe(4);
  });

  it('does not split a decimal number', () => {
    expect(sentenceCount('The pond is 3.5 steps away.')).toBe(1);
  });

  it('ends a sentence before a closing quote', () => {
    expect(sentenceCount('Pip said "hello." Then Pip napped.')).toBe(2);
  });

  it('is 0 for blank text', () => {
    expect(sentenceCount('   ')).toBe(0);
  });
});
