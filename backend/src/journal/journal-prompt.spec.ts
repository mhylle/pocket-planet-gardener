import {
  findPrivateData,
  toPlanetPublicState,
  toPublicEvents,
} from '../ai/prompt-context';
import type { DecorationId } from '../content/content.types';
import {
  buildJournalPrompt,
  describeViolations,
  JOURNAL_TEXT_MAX,
  parseJournal,
} from './journal-prompt';

const planetId = '3f2b8c1e-9a4d-4e6f-8b2a-1c5d7e9f0a12';
const otherPlanetId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const creatureId = '0b9e6f42-7c1d-4a8e-9f3b-2d6c8a1e5f70';
const code = 'K7MPQ2XR';
const AT = '2030-01-01T02:00:00.000Z';

/** A planet that tempts a careless builder with ids, the code and an email. */
const tempting = {
  id: planetId,
  code,
  name: `Moss Moon ${planetId}`,
  plants: [
    { id: creatureId, type: 'clover', stage: 'bloom', lat: 1, lon: 2 },
    { id: creatureId, type: 'clover', stage: 'bloom', lat: 3, lon: 4 },
    { id: otherPlanetId, type: 'sunflower', stage: 'sprout', lat: 5, lon: 6 },
  ],
  decorations: [
    { id: creatureId, type: 'pond' as DecorationId, lat: 7, lon: 8 },
    { id: creatureId, type: 'kid@example.com' as DecorationId, lat: 9, lon: 0 },
  ],
  creatures: [
    {
      id: creatureId,
      planetId: otherPlanetId,
      name: 'Wigglenut',
      species: 'worm',
      summary: `Loves pebbles. Pen pal ${otherPlanetId} kid@example.com`,
    },
  ],
};

/** Logged events with the ids and positions a real log holds. */
const logged = [
  {
    type: 'plant-stage',
    occurredAt: AT,
    payload: { plantId: creatureId, type: 'clover', stage: 'sprout' },
  },
  {
    type: 'plant-bloomed',
    occurredAt: AT,
    payload: { plantId: creatureId, type: 'clover', lat: 1, lon: 2 },
  },
  {
    type: 'plant-bloomed',
    occurredAt: AT,
    payload: { plantId: otherPlanetId, type: 'clover', lat: 3, lon: 4 },
  },
  {
    type: 'creature-arrived',
    occurredAt: AT,
    payload: {
      creatureId,
      species: 'worm',
      name: 'Wigglenut',
      lat: 5,
      lon: 6,
      milestone: true,
    },
  },
];

function prompt(events = logged, source = tempting) {
  return buildJournalPrompt({
    date: 'Tuesday 1 January',
    planet: toPlanetPublicState(source),
    events: toPublicEvents(events),
    maxWords: 150,
  });
}

describe('buildJournalPrompt', () => {
  it('sends the rules as the system message and the facts as the user message', () => {
    const [system, user] = prompt();

    expect(system.role).toBe('system');
    expect(user.role).toBe('user');
    expect(user.content).toContain('Today is Tuesday 1 January.');
    expect(user.content).toContain('The planet is called "Moss Moon');
    expect(user.content).toContain(
      'Plants: 2 clover (bloom), 1 sunflower (sprout).',
    );
    expect(user.content).toContain('Decorations: 1 pond.');
    expect(user.content).toContain(
      '- Wigglenut the worm: Loves pebbles. Pen pal',
    );
  });

  it('lists the news, repeats counted and growth steps left out', () => {
    const user = prompt()[1].content;

    expect(user).toContain(
      'News since the last diary page, oldest first:\n- clover bloomed (2 times)\n- Wigglenut the worm moved in',
    );
    expect(user).not.toContain('sprouted');
  });

  it('says when nothing happened and nobody lives here yet (JRN-02 AC3)', () => {
    const user = prompt([], { ...tempting, creatures: [] })[1].content;

    expect(user).toContain(
      'News since the last diary page: none, it was a quiet time.',
    );
    expect(user).toContain('No creatures live here yet.');
  });

  it('embeds the length, voice, names, facts and tone rules (JRN-01 AC2, JRN-02, SD section 10)', () => {
    const rules = prompt()[0].content;

    for (const rule of [
      'at most 150 words',
      'no title, no date line and no markdown',
      'Warm, kind, funny and a little absurd',
      'all ages',
      'Mention the creatures who live on the planet by name, and only those creatures',
      'Never make up a creature or a name',
      'must be in the news list',
      'Never invent anything that changed on the planet',
      'no gifts, parcels or presents',
      'Give no numbers of plants or flowers',
      'harmless colour',
      'a short, cosy page about a quiet day',
      'Never guilt-trip or pressure the gardener',
      'no politics and no religion',
      'Write in English',
    ]) {
      expect(rules).toContain(rule);
    }
  });

  it('contains no ids, no planet code and no email (AIB-02)', () => {
    expect(findPrivateData(JSON.stringify(prompt()), [planetId, code])).toEqual(
      [],
    );
  });
});

describe('parseJournal', () => {
  it('trims the reply and drops a code fence', () => {
    expect(parseJournal('  A quiet day.  ')).toBe('A quiet day.');
    expect(parseJournal('```text\nA quiet day.\n```')).toBe('A quiet day.');
  });

  it('gives null for an empty reply or one too long to store', () => {
    expect(parseJournal(' \n ')).toBeNull();
    expect(parseJournal('```\n```')).toBeNull();
    expect(parseJournal('a'.repeat(JOURNAL_TEXT_MAX + 1))).toBeNull();
  });
});

describe('describeViolations', () => {
  it('words each violation for the retry', () => {
    expect(describeViolations(['unknown-creature', 'invented-gift'])).toEqual([
      'it named a creature that does not live on the planet',
      'it mentioned a gift, parcel or present that is not in the news',
    ]);
  });
});
