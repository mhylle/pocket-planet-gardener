import { checkText, wordCount } from '../ai/content-rules';
import type { PlantId, SpeciesId } from '../content/content.types';
import { PLANTS } from '../content/plants';
import { SPECIES } from '../content/species';
import {
  dateRng,
  journalDate,
  TEMPLATE_MAX_WORDS,
  templateEntry,
  verify,
  type JournalEvent,
  type JournalFacts,
} from './journal-fact-check';

const DAY_MS = 86_400_000;
const THURSDAY = new Date('2025-10-02T09:00:00.000Z');

function bloom(type: PlantId): JournalEvent {
  return { type: 'plant-bloomed', payload: { type, lat: 1, lon: 2 } };
}

function arrival(name: string, species: SpeciesId): JournalEvent {
  return {
    type: 'creature-arrived',
    payload: { name, species, milestone: true },
  };
}

function wish(name: string): JournalEvent {
  return { type: 'want-fulfilled', payload: { name, species: 'worm' } };
}

function gift(name: string): JournalEvent {
  return { type: 'gift-received', payload: { name, species: 'moth' } };
}

const STAGE: JournalEvent = {
  type: 'plant-stage',
  payload: { type: 'clover', stage: 'sprout' },
};

function facts(
  events: JournalEvent[] = [],
  overrides: Partial<JournalFacts> = {},
): JournalFacts {
  return {
    events,
    creatureNames: ['Wigglenut', 'Mira'],
    planetName: 'Moonbeam',
    maxWords: 188,
    ...overrides,
  };
}

describe('journalDate', () => {
  it('heads an entry with weekday, day and month, in UTC', () => {
    expect(journalDate(THURSDAY)).toBe('Thursday 2 October');
    expect(journalDate(new Date('2030-01-01T23:59:00.000Z'))).toBe(
      'Tuesday 1 January',
    );
  });
});

describe('verify', () => {
  it('accepts an entry true to the events, with harmless colour', () => {
    const text =
      'What a Thursday! The sunflower bloomed and Wigglenut the worm moved in. ' +
      'Mira thought the bloom looked like a tiny sun and told it so, twice.';

    expect(
      verify(text, facts([bloom('sunflower'), arrival('Wigglenut', 'worm')])),
    ).toEqual([]);
  });

  it('accepts a quiet entry about the weather and a nap when nothing happened (JRN-02 AC3)', () => {
    const text =
      'A quiet day on Moonbeam. Mira the moth stared at the lamp-post for six hours and called it "research". ' +
      'The clouds drifted by, and Wigglenut napped through all of it.';

    expect(verify(text, facts([]))).toEqual([]);
  });

  describe('creatures (JRN-02 AC2)', () => {
    it('refuses a made-up creature beside a species word: "Zorblax the snail"', () => {
      const text = 'Zorblax the snail waved at Wigglenut from the pond.';

      expect(verify(text, facts())).toEqual(['unknown-creature']);
    });

    it('refuses "a snail named Zorblax"', () => {
      expect(
        verify('A snail named Zorblax sang to the clover.', facts()),
      ).toEqual(['unknown-creature']);
    });

    it('refuses a name from the pre-written pool that is not on the planet, but not one that is', () => {
      const text = 'Bartholomew sat on the bench all afternoon.';

      expect(verify(text, facts())).toEqual(['unknown-creature']);
      expect(
        verify(text, facts([], { creatureNames: ['Bartholomew'] })),
      ).toEqual([]);
    });

    it('allows the creatures on the planet, also after a word that starts the sentence', () => {
      const text =
        'Then Wigglenut the worm yawned. Meanwhile the snail-shaped cloud drifted on. ' +
        'On Thursday the bee in the story was only a dream.';

      expect(verify(text, facts())).toEqual([]);
    });

    it('allows the planet name, the gardener, Pip and the catalogue, even when one is a pool name', () => {
      const text =
        'Moonbeam was calm. The Gardener smiled, Pip waved, and Clover the snail was just a joke Mira told.';

      expect(verify(text, facts())).toEqual([]);
    });

    it('matches a multi-word name on the planet', () => {
      const text = 'Professor Loam the worm gave a lecture about soil.';

      expect(
        verify(text, facts([], { creatureNames: ['Professor Loam'] })),
      ).toEqual([]);
      expect(verify(text, facts())).toEqual(['unknown-creature']);
    });
  });

  describe('event words (JRN-02 AC1)', () => {
    it('refuses "a parcel arrived" without a gift event', () => {
      const violations = verify('A parcel arrived for Mira.', facts([]));

      expect(violations).toContain('invented-gift');
    });

    it('accepts it when the gift and an arrival are in the log', () => {
      expect(
        verify(
          'A parcel arrived for Mira.',
          facts([gift('Mira'), arrival('Mira', 'moth')]),
        ),
      ).toEqual([]);
    });

    it.each([
      ['Mira left you a lovely present.', 'invented-gift', gift('Mira')],
      [
        'A new neighbour moved in by the pond.',
        'invented-arrival',
        arrival('Mira', 'moth'),
      ],
      ['The tulip bloomed overnight.', 'invented-bloom', bloom('tulip')],
      ['Every bud blossomed at once.', 'invented-bloom', bloom('tulip')],
      ["Wigglenut's wish came true!", 'invented-wish', wish('Wigglenut')],
      ['The gardener granted his wish.', 'invented-wish', wish('Wigglenut')],
    ])('"%s" → %s, unless the event is logged', (text, violation, event) => {
      expect(verify(text, facts([STAGE]))).toEqual([violation]);
      expect(verify(text, facts([event]))).toEqual([]);
    });

    it('lets present-tense blooming and wishing pass: they claim no new event', () => {
      const text =
        'The clovers are blooming happily, and Mira wishes for a nap.';

      expect(verify(text, facts([]))).toEqual([]);
    });
  });

  describe('counts', () => {
    it('refuses more blooms than were logged', () => {
      const text = 'Three clovers bloomed in a row.';

      expect(verify(text, facts([bloom('clover'), bloom('clover')]))).toEqual([
        'wrong-count',
      ]);
      expect(
        verify(
          text,
          facts([bloom('clover'), bloom('clover'), bloom('sunflower')]),
        ),
      ).toEqual([]);
    });

    it('counts digits and words a little apart from the plant word', () => {
      expect(
        verify('5 tiny pink blooms appeared.', facts([bloom('tulip')])),
      ).toEqual(['wrong-count']);
      expect(
        verify('Two of the sunflowers nodded.', facts([bloom('sunflower')])),
      ).toEqual(['wrong-count']);
    });

    it('does not count a lone "one", or numbers of other things', () => {
      expect(
        verify('One clover nodded, and Mira counted six clouds.', facts([])),
      ).toEqual([]);
    });
  });

  it('refuses an entry longer than maxWords', () => {
    const text = 'Mira napped. '.repeat(6).trim();

    expect(verify(text, facts([], { maxWords: 11 }))).toEqual(['too-long']);
    expect(verify(text, facts([], { maxWords: 12 }))).toEqual([]);
  });
});

describe('templateEntry', () => {
  it('writes a short, cosy entry naming a real creature when nothing happened (JRN-02 AC3)', () => {
    const quiet = facts([]);

    const text = templateEntry([], quiet, THURSDAY, dateRng(THURSDAY));

    expect(wordCount(text)).toBeLessThanOrEqual(TEMPLATE_MAX_WORDS);
    expect(text).toMatch(/Wigglenut|Mira/);
    expect(text).toMatch(/Moonbeam|Thursday/);
    expect(verify(text, quiet)).toEqual([]);
    expect(checkText(text, { maxWords: quiet.maxWords })).toEqual([]);
  });

  it('names no creature on a planet without one', () => {
    const empty = facts([], { creatureNames: [] });

    const text = templateEntry([], empty, THURSDAY, dateRng(THURSDAY));

    expect(verify(text, empty)).toEqual([]);
    expect(checkText(text)).toEqual([]);
  });

  it('tells a busy day from the events: the blooms by type, the newcomer by name, wishes and gifts', () => {
    const events = [
      STAGE,
      bloom('clover'),
      bloom('clover'),
      bloom('clover'),
      bloom('sunflower'),
      arrival('Mira', 'moth'),
      wish('Wigglenut'),
      gift('Mira'),
    ];
    const busy = facts(events);

    const text = templateEntry(events, busy, THURSDAY, () => 0);

    expect(text).toContain('Three clovers and a sunflower bloomed');
    expect(text).toContain('Mira the moth moved in');
    expect(text).toContain("Wigglenut's wish came true");
    expect(text).toContain('gift');
    expect(verify(text, busy)).toEqual([]);
    expect(checkText(text, { maxWords: busy.maxWords })).toEqual([]);
  });

  it('varies its wording from day to day', () => {
    const texts = new Set(
      Array.from({ length: 7 }, (_, day) => {
        const date = new Date(THURSDAY.getTime() + day * DAY_MS);
        return templateEntry([], facts([]), date, dateRng(date));
      }),
    );

    expect(texts.size).toBeGreaterThan(1);
  });

  it('gives the same entry for the same day', () => {
    const later = new Date(THURSDAY.getTime() + 3_600_000);

    expect(templateEntry([], facts([]), later, dateRng(later))).toBe(
      templateEntry([], facts([]), THURSDAY, dateRng(THURSDAY)),
    );
  });

  describe('over random days (property-style)', () => {
    const NAMES = [
      'Wigglenut',
      'Mira',
      'Professor Loam',
      'Bartholomew',
      'Sir Buzzalot',
      'Pebble',
      'Dottie',
      'Hopscotch',
    ];
    const PLANETS = ['Moonbeam', 'Moss Moon', 'Tiny Teacup', 'Pocket Pear'];

    /** A planet's creatures and a random stretch of its log, all consistent. */
    function randomDay(seed: number): {
      events: JournalEvent[];
      facts: JournalFacts;
    } {
      const rng = dateRng(new Date(seed * DAY_MS));
      const int = (max: number) => Math.floor(rng() * (max + 1));
      const pickOf = <T>(items: readonly T[]) => items[int(items.length - 1)];
      const creatures = NAMES.slice(0, int(NAMES.length));
      const events: JournalEvent[] = [];
      for (let i = int(14); i > 0; i--) {
        events.push(bloom(pickOf(PLANTS).id), STAGE);
      }
      // Arrivals among the planet's creatures, the latest ones.
      for (const name of creatures.slice(
        creatures.length - int(Math.min(4, creatures.length)),
      )) {
        events.push(arrival(name, pickOf(SPECIES).id));
      }
      if (creatures.length > 0) {
        for (let i = int(3); i > 0; i--) events.push(wish(pickOf(creatures)));
        for (let i = int(2); i > 0; i--) events.push(gift(pickOf(creatures)));
      }
      return {
        events,
        facts: facts(events, {
          creatureNames: creatures,
          planetName: pickOf(PLANETS),
        }),
      };
    }

    it('is always at most 150 words, true to the facts, within the content rules and names a creature when there is one', () => {
      for (let seed = 1; seed <= 400; seed++) {
        const day = randomDay(seed);
        const date = new Date(THURSDAY.getTime() + seed * DAY_MS);

        const text = templateEntry(day.events, day.facts, date, dateRng(date));

        const where = `seed ${seed}: ${text}`;
        expect([where, wordCount(text) <= TEMPLATE_MAX_WORDS]).toEqual([
          where,
          true,
        ]);
        expect([where, verify(text, day.facts)]).toEqual([where, []]);
        expect([
          where,
          checkText(text, { maxWords: day.facts.maxWords }),
        ]).toEqual([where, []]);
        if (day.facts.creatureNames.length > 0) {
          expect([
            where,
            day.facts.creatureNames.some((name) => text.includes(name)),
          ]).toEqual([where, true]);
        }
      }
    });
  });
});
