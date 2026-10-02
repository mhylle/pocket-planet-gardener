import { checkText } from '../ai/content-rules';
import { findPrivateData, toPlanetPublicState } from '../ai/prompt-context';
import type { DecorationId } from '../content/content.types';
import {
  buildIdentityPrompt,
  identityProblems,
  identityTexts,
  parseIdentity,
} from './identity-prompt';
import type { CreatureIdentity } from './identity.types';

const planetId = '3f2b8c1e-9a4d-4e6f-8b2a-1c5d7e9f0a12';
const otherPlanetId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const creatureId = '0b9e6f42-7c1d-4a8e-9f3b-2d6c8a1e5f70';
const code = 'K7MPQ2XR';

/** A planet that tempts a careless builder with ids, the code and an email. */
const tempting = {
  id: planetId,
  code,
  name: `Moss Moon ${planetId}`,
  plants: [
    { id: creatureId, type: 'clover', stage: 'bloom', lat: 1, lon: 2 },
    { id: creatureId, type: 'clover', stage: 'bloom', lat: 3, lon: 4 },
    { id: otherPlanetId, type: 'moonflower', stage: 'sprout', lat: 5, lon: 6 },
  ],
  decorations: [
    { id: creatureId, type: 'pond' as DecorationId, lat: 7, lon: 8 },
    { id: creatureId, type: 'kid@example.com' as DecorationId, lat: 9, lon: 0 },
  ],
  creatures: [
    {
      id: creatureId,
      planetId: otherPlanetId,
      name: 'Lumen',
      species: 'moth',
      summary: `Loves lamps. Pen pal ${otherPlanetId} kid@example.com`,
    },
  ],
};

const planet = toPlanetPublicState(tempting);

function prompt(existingNames: string[] = ['Lumen']) {
  return buildIdentityPrompt({ species: 'snail', planet, existingNames });
}

const valid: CreatureIdentity = {
  name: 'Bartholomew',
  traits: ['dramatic', 'proud'],
  quirk: 'He believes he is a famous opera singer.',
  speakingStyle: 'grand and theatrical',
  backstory: 'He sings to the clover. He bows slowly. The bow takes all day.',
  summary: 'A slow snail who believes he is an opera star.',
};

describe('buildIdentityPrompt', () => {
  it('sends the rules as the system message and the planet facts as the user message', () => {
    const [system, user] = prompt();

    expect(system.role).toBe('system');
    expect(user.role).toBe('user');
    expect(user.content).toContain('A new snail has just moved in');
    expect(user.content).toContain('Likes ponds and plenty of clover.');
    expect(user.content).toContain('Moss Moon');
    expect(user.content).toContain(
      'Plants: 2 clover (bloom), 1 moonflower (sprout).',
    );
    expect(user.content).toContain('Decorations: 1 pond.');
    expect(user.content).toContain('- Lumen the moth: Loves lamps. Pen pal');
    expect(user.content).toContain('Names already used on the planet: Lumen.');
  });

  it('embeds the tone and content rules and the JSON form (SD section 10)', () => {
    const rules = prompt()[0].content;

    for (const rule of [
      'Warm, kind, playful and a little absurd',
      'all ages',
      "the creature's own quirk",
      'a snail does not fly, a moth likes lamps',
      'real people',
      'fictional character or celebrity',
      'No violence, nothing scary, no romance, no swearing, no alcohol, no drugs, no politics and no religion',
      'Never guilt-trip',
      'never claims to be a real animal',
      'English',
      '"traits": ["...", "..."]',
      '2 or 3 short adjectives',
      'at most 3 sentences',
      'at most 12 words',
      'at most 20 characters',
    ]) {
      expect(rules).toContain(rule);
    }
  });

  it('says so when the planet is still empty', () => {
    const [, user] = buildIdentityPrompt({
      species: 'worm',
      planet: { name: 'Pebble', plants: [], decorations: [], creatures: [] },
      existingNames: [],
    });

    expect(user.content).toContain('Plants: none.');
    expect(user.content).toContain('Decorations: none.');
    expect(user.content).toContain('No other creatures live here yet.');
    expect(user.content).not.toContain('Names already used');
  });

  it('leaks no id, code or address, even from player-typed names (AIB-02)', () => {
    const json = JSON.stringify(
      prompt(['Lumen', 'kid@example.com', `Bo ${creatureId}`]),
    );

    expect(
      findPrivateData(json, [planetId, otherPlanetId, creatureId, code]),
    ).toEqual([]);
    expect(json).not.toContain('lat');
  });
});

describe('parseIdentity', () => {
  it('reads the identity from a fenced reply, trimming each text', () => {
    const reply =
      'Here it is:\n```json\n' +
      JSON.stringify({ ...valid, name: ' Bartholomew ', traits: [' proud '] }) +
      '\n```';

    expect(parseIdentity(reply)).toEqual({
      ...valid,
      traits: ['proud'],
    });
  });

  it('keeps only the identity fields', () => {
    const reply = JSON.stringify({ ...valid, planetId, extra: 1 });

    expect(parseIdentity(reply)).toEqual(valid);
  });

  it.each([
    ['no JSON', 'A snail called Bo.'],
    ['an array', '[1, 2]'],
    ['a missing field', JSON.stringify({ ...valid, summary: undefined })],
    ['traits that are not a list', JSON.stringify({ ...valid, traits: 'shy' })],
    [
      'a trait that is not text',
      JSON.stringify({ ...valid, traits: ['shy', 3] }),
    ],
    ['a name that is not text', JSON.stringify({ ...valid, name: 7 })],
  ])('is null for %s', (_label, reply) => {
    expect(parseIdentity(reply)).toBeNull();
  });
});

describe('identityProblems', () => {
  it('accepts a valid identity whose texts all pass checkText', () => {
    expect(identityProblems(valid, ['Lumen'])).toEqual([]);
    for (const text of identityTexts(valid)) {
      expect(checkText(text)).toEqual([]);
    }
  });

  it('rejects a name already used on the planet, ignoring case (CRT-03 AC2)', () => {
    expect(identityProblems(valid, [' bartholomew '])).toEqual([
      'the name "Bartholomew" is already used on the planet',
    ]);
  });

  it.each(['Pikachu', 'Harry Potter', 'Goofy', 'Ass Face'])(
    'rejects the famous or rude name %s',
    (name) => {
      expect(identityProblems({ ...valid, name }, [])).toEqual([
        'the name must be original, not a famous character, a celebrity or a rude word',
      ]);
    },
  );

  it('rejects an empty or over-long name', () => {
    for (const name of ['', 'A'.repeat(21)]) {
      expect(identityProblems({ ...valid, name }, [])).toEqual([
        'the name must be 1 to 20 characters long',
      ]);
    }
    expect(identityProblems({ ...valid, name: 'A'.repeat(20) }, [])).toEqual(
      [],
    );
  });

  it('needs 2 or 3 short traits', () => {
    expect(identityProblems({ ...valid, traits: ['shy'] }, [])).toEqual([
      'it needs 2 or 3 traits, not 1',
    ]);
    expect(
      identityProblems({ ...valid, traits: ['a', 'b', 'c', 'd'] }, []),
    ).toEqual(['it needs 2 or 3 traits, not 4']);
    expect(
      identityProblems(
        { ...valid, traits: ['shy', 'very fond of long walks'] },
        [],
      ),
    ).toEqual(['each trait must be a short adjective']);
  });

  it('rejects a backstory of 4 sentences but takes 3', () => {
    expect(
      identityProblems({ ...valid, backstory: 'One. Two! Three? Four.' }, []),
    ).toEqual(['the backstory had more than 3 sentences']);
    expect(
      identityProblems({ ...valid, backstory: 'One. Two! Three?' }, []),
    ).toEqual([]);
  });

  it('rejects a summary over 12 words, a long quirk and a long speaking style', () => {
    const thirteen =
      'one two three four five six seven eight nine ten eleven twelve thirteen';
    expect(
      identityProblems(
        {
          ...valid,
          summary: thirteen,
          quirk: 'One. Two. Three.',
          speakingStyle: thirteen,
        },
        [],
      ),
    ).toEqual([
      'the quirk must be one sentence',
      'the speaking style must be a short phrase of at most 12 words',
      'the summary was longer than 12 words',
    ]);
  });
});

describe('identityTexts', () => {
  it('lists every text a player reads', () => {
    expect(identityTexts(valid)).toEqual([
      'Bartholomew',
      'dramatic',
      'proud',
      valid.quirk,
      valid.speakingStyle,
      valid.backstory,
      valid.summary,
    ]);
  });
});
