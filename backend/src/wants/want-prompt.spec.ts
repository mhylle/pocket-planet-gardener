import { findPrivateData, toPlanetPublicState } from '../ai/prompt-context';
import type { DecorationId } from '../content/content.types';
import type { CreatureIdentity } from '../creatures/identity.types';
import type { WantSpec, WantWorld } from './want-evaluator';
import {
  allowedWantTypes,
  buildWantPrompt,
  parseWant,
  wantProblems,
  type WantPromptInput,
  type WantRules,
} from './want-prompt';

const planetId = '3f2b8c1e-9a4d-4e6f-8b2a-1c5d7e9f0a12';
const otherPlanetId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const creatureId = '0b9e6f42-7c1d-4a8e-9f3b-2d6c8a1e5f70';
const code = 'K7MPQ2XR';

const identity: CreatureIdentity = {
  name: 'Mira',
  traits: ['dramatic', 'refined'],
  quirk: 'She calls every lamp a moon.',
  speakingStyle: 'grand, speaks of herself as one',
  backstory:
    'Mira arrived at dusk. She has stared at the lamp-post ever since.',
  summary: 'A grand moth who calls every lamp a moon.',
};

/** A planet that tempts a careless builder with ids, the code and an email. */
const tempting = {
  id: planetId,
  code,
  name: `Moss Moon ${planetId}`,
  plants: [
    { id: creatureId, type: 'clover', stage: 'bloom', lat: 1, lon: 2 },
    { id: otherPlanetId, type: 'moonflower', stage: 'sprout', lat: 5, lon: 6 },
  ],
  decorations: [
    { id: creatureId, type: 'lamp-post' as DecorationId, lat: 7, lon: 8 },
    { id: creatureId, type: 'kid@example.com' as DecorationId, lat: 9, lon: 0 },
  ],
  creatures: [
    {
      id: creatureId,
      name: 'Mira',
      species: 'moth',
      summary: identity.summary,
    },
    {
      id: creatureId,
      planetId: otherPlanetId,
      name: 'Bo',
      species: 'snail',
      summary: `Slow. Pen pal ${otherPlanetId} kid@example.com`,
    },
  ],
};

function input(overrides: Partial<WantPromptInput> = {}): WantPromptInput {
  return {
    creature: { species: 'moth', name: 'Mira', identity },
    memories: ['Mira was given a lamp-post.'],
    planet: toPlanetPublicState(tempting),
    unlocked: new Set(['clover', 'moonflower', 'lamp-post', 'pond']),
    ...overrides,
  };
}

const world: WantWorld = {
  plants: [{ type: 'clover', stage: 'bloom', lat: 0, lon: 0 }],
  decorations: [{ type: 'lamp-post', lat: 0, lon: 20 }],
};

function rules(overrides: Partial<WantRules> = {}): WantRules {
  return {
    unlocked: new Set([
      'clover',
      'sunflower',
      'moonflower',
      'lamp-post',
      'pond',
    ]),
    maxPlants: 60,
    plantCount: 1,
    world,
    home: { lat: 0, lon: 0 },
    ...overrides,
  };
}

const moonflowersNearLamp: WantSpec = {
  type: 'plant-near',
  plant: 'moonflower',
  count: 2,
  near: { kind: 'decoration', decoration: 'lamp-post' },
  withinSteps: 3,
};

describe('buildWantPrompt', () => {
  it('sends the rules as the system message and the creature and planet as the user message', () => {
    const [system, user] = buildWantPrompt(input());

    expect(system.role).toBe('system');
    expect(user.role).toBe('user');
    for (const fact of [
      'The creature is Mira the moth.',
      'About moths: Drawn to lamp-posts and moonflowers.',
      'Traits: dramatic, refined.',
      'Quirk: She calls every lamp a moon.',
      'Speaking style: grand, speaks of herself as one.',
      'About Mira: Mira arrived at dusk.',
      'Mira remembers:\n- Mira was given a lamp-post.',
      'Moss Moon',
      'Plants: 1 clover (bloom), 1 moonflower (sprout).',
      'Decorations: 1 lamp-post.',
      'Other creatures living here:\n- Bo the snail: Slow.',
      'Plants it may ask for, by id: clover (Clover), moonflower (Moonflower).',
      'Decorations it may ask for, by id: pond (Pond), lamp-post (Lamp-post).',
      "Write Mira's next wish.",
    ]) {
      expect(user.content).toContain(fact);
    }
    expect(user.content).not.toContain('- Mira the moth');
  });

  it('embeds the tone rules, the voice, the length and every ordinary want shape (WNT-01 AC3)', () => {
    const rules = buildWantPrompt(input())[0].content;

    for (const rule of [
      "the creature's own voice, with its speaking style, traits and quirk",
      'at most 2 short sentences, each ending with . ! or ?, no ellipses, and at most 35 words',
      '"One requires moonflowers. Near the lamp-post, obviously."',
      'Warm, kind, playful and a little absurd',
      'all ages',
      'a snail does not fly, a moth likes lamps',
      'never guilt-trips',
      'real people',
      'No violence, nothing scary, no romance, no swearing, no alcohol, no drugs, no politics and no religion',
      'never asks for personal information',
      'never claims to be a real animal',
      'Use only the plant and decoration ids listed',
      'English',
      '{"spec": {...}, "text": "..."}',
      '{"type": "plant-near", "plant": "<plant id>"',
      '{"kind": "home"} or {"kind": "decoration", "decoration": "<decoration id>"}',
      '{"type": "count-blooming"',
      '{"type": "place-decoration"',
      '{"type": "variety", "distinct": <number>',
      'count 1 to 5, distinct 2 to 4, withinSteps 1 to 6',
    ]) {
      expect(rules).toContain(rule);
    }
    expect(rules).not.toContain('bring-back');
  });

  it('asks a wistful creature for exactly the bring-back and lists no items (CRT-04 AC3)', () => {
    const [system, user] = buildWantPrompt(
      input({ bringBack: { itemKind: 'decoration', item: 'lamp-post' } }),
    );

    expect(system.content).toContain(
      '{"spec": {"type":"bring-back","itemKind":"decoration","item":"lamp-post"}, "text": "..."}',
    );
    expect(system.content).not.toContain('"type": "count-blooming"');
    expect(user.content).toContain(
      'The lamp-post that Mira loved is gone from the planet. The wish asks for it back.',
    );
    expect(user.content).not.toContain('may ask for');
  });

  it('in the tutorial lists only what the player holds, with how many (ONB-02 AC3)', () => {
    const [, user] = buildWantPrompt(
      input({
        tutorial: true,
        owned: new Map([
          ['clover', 3],
          ['sunflower', 2],
          ['pond', 0],
        ]),
      }),
    );

    expect(user.content).toContain(
      'Plants it may ask for, by id: clover (Clover).',
    );
    expect(user.content).toContain('Decorations it may ask for, by id: none.');
    expect(user.content).toContain(
      'it must be possible with only what the player holds now: 3 clover.',
    );
  });

  it('leaves out memories that look like an id or an address', () => {
    const [, user] = buildWantPrompt(
      input({
        memories: ['Likes the pond.', `Met ${creatureId}`, 'kid@example.com'],
      }),
    );

    expect(user.content).toContain('- Likes the pond.');
    expect(user.content).not.toContain('Met ');
  });

  it('leaks no id, code, address or position (AIB-02)', () => {
    const json = JSON.stringify(
      buildWantPrompt({
        ...input({
          memories: [`Pen pal ${otherPlanetId}`, 'Mail kid@example.com'],
          unlocked: new Set(['clover', 'kid@example.com', planetId]),
          owned: new Map([[planetId, 2]]),
          tutorial: true,
        }),
        // A caller may pass a whole creature; only named fields are read.
        creature: Object.assign(
          { id: creatureId, planetId, home: { lat: 12.5, lon: 40 } },
          { species: 'moth' as const, name: 'Mira', identity },
        ),
      }),
    );

    expect(
      findPrivateData(json, [planetId, otherPlanetId, creatureId, code]),
    ).toEqual([]);
    expect(json).not.toContain('lat');
    expect(json).not.toContain('12.5');
  });
});

describe('parseWant', () => {
  it('reads the want from a fenced reply, trimming the text', () => {
    const reply =
      'Here:\n```json\n' +
      JSON.stringify({
        spec: moonflowersNearLamp,
        text: ' One requires moonflowers. Near the lamp-post, obviously. ',
      }) +
      '\n```';

    expect(parseWant(reply)).toEqual({
      spec: moonflowersNearLamp,
      text: 'One requires moonflowers. Near the lamp-post, obviously.',
    });
  });

  it('keeps only the fields of the spec', () => {
    const reply = JSON.stringify({
      spec: { type: 'count-blooming', plant: 'tulip', count: 2, planetId },
      text: 'Tulips!',
      extra: 1,
    });

    expect(parseWant(reply)).toEqual({
      spec: { type: 'count-blooming', plant: 'tulip', count: 2 },
      text: 'Tulips!',
    });
  });

  it.each<WantSpec>([
    { type: 'place-decoration', decoration: 'bench' },
    { type: 'variety', distinct: 3, withinSteps: 2 },
    {
      type: 'plant-near',
      plant: 'fern',
      count: 1,
      near: { kind: 'home' },
      withinSteps: 2,
    },
    { type: 'bring-back', itemKind: 'plant', item: 'clover' },
    { type: 'bring-back', itemKind: 'decoration', item: 'pond' },
  ])('reads a $type want', (spec) => {
    expect(parseWant(JSON.stringify({ spec, text: 'Please.' }))).toEqual({
      spec,
      text: 'Please.',
    });
  });

  it.each([
    ['no JSON', 'Moonflowers, please.'],
    ['no text', JSON.stringify({ spec: moonflowersNearLamp })],
    ['no spec', JSON.stringify({ text: 'Hi.' })],
    [
      'an unknown type',
      JSON.stringify({ spec: { type: 'dance' }, text: 'Hi.' }),
    ],
    [
      'a plant that is not in the catalogue',
      JSON.stringify({
        spec: { type: 'count-blooming', plant: 'rose', count: 2 },
        text: 'Hi.',
      }),
    ],
    [
      'a decoration where a plant belongs',
      JSON.stringify({
        spec: { type: 'count-blooming', plant: 'pond', count: 2 },
        text: 'Hi.',
      }),
    ],
    [
      'a count that is not a number',
      JSON.stringify({
        spec: { type: 'count-blooming', plant: 'clover', count: 'two' },
        text: 'Hi.',
      }),
    ],
    [
      'an anchor of an unknown kind',
      JSON.stringify({
        spec: { ...moonflowersNearLamp, near: { kind: 'moon' } },
        text: 'Hi.',
      }),
    ],
    [
      'a bring-back of a plant named as a decoration',
      JSON.stringify({
        spec: { type: 'bring-back', itemKind: 'decoration', item: 'clover' },
        text: 'Hi.',
      }),
    ],
  ])('is null for %s', (_label, reply) => {
    expect(parseWant(reply)).toBeNull();
  });
});

describe('allowedWantTypes', () => {
  it('allows every type but bring-back, or only bring-back for a wistful creature', () => {
    expect(allowedWantTypes()).toEqual([
      'plant-near',
      'count-blooming',
      'place-decoration',
      'variety',
    ]);
    expect(allowedWantTypes({ itemKind: 'decoration', item: 'pond' })).toEqual([
      'bring-back',
    ]);
  });
});

describe('wantProblems', () => {
  it('accepts an achievable want the planet does not meet yet', () => {
    expect(wantProblems(moonflowersNearLamp, rules())).toEqual([]);
  });

  it('rejects a locked plant or a number out of range (WNT-02 AC1)', () => {
    const problem =
      'it may only name the listed ids, with whole numbers in the given ranges';
    expect(
      wantProblems(
        { type: 'count-blooming', plant: 'cactus', count: 2 },
        rules(),
      ),
    ).toEqual([problem]);
    expect(
      wantProblems(
        { type: 'count-blooming', plant: 'clover', count: 9 },
        rules(),
      ),
    ).toEqual([problem]);
    expect(
      wantProblems({ ...moonflowersNearLamp, withinSteps: 2.5 }, rules()),
    ).toEqual([problem]);
  });

  it('rejects a want the planet already meets', () => {
    expect(
      wantProblems(
        { type: 'place-decoration', decoration: 'lamp-post' },
        rules(),
      ),
    ).toEqual([
      'the planet already has that, so ask for something it does not have yet',
    ]);
  });

  it('rejects a bring-back nobody asked for', () => {
    expect(
      wantProblems(
        { type: 'bring-back', itemKind: 'decoration', item: 'pond' },
        rules(),
      ),
    ).toEqual(['the type must be one of the listed types']);
  });

  it('for a wistful creature takes only a bring-back of exactly that item (CRT-04 AC3)', () => {
    const wistful = rules({
      bringBack: { itemKind: 'decoration', item: 'pond' },
    });
    const wrongItem =
      'the spec must be exactly {"type":"bring-back","itemKind":"decoration","item":"pond"}, asking for the pond back';

    expect(
      wantProblems(
        { type: 'bring-back', itemKind: 'decoration', item: 'pond' },
        wistful,
      ),
    ).toEqual([]);
    expect(
      wantProblems(
        { type: 'bring-back', itemKind: 'decoration', item: 'lamp-post' },
        wistful,
      ),
    ).toEqual([wrongItem]);
    expect(wantProblems(moonflowersNearLamp, wistful)).toEqual([wrongItem]);
  });

  it('takes the bring-back even when the item is on the planet in another form', () => {
    const wistful = rules({ bringBack: { itemKind: 'plant', item: 'clover' } });

    expect(
      wantProblems(
        { type: 'bring-back', itemKind: 'plant', item: 'clover' },
        wistful,
      ),
    ).toEqual([]);
  });

  describe('in the tutorial (ONB-02 AC3)', () => {
    const tutorial = rules({
      tutorial: true,
      owned: new Map([
        ['clover', 3],
        ['sunflower', 2],
      ]),
    });
    const problem =
      'it must be possible with only the items the player holds now';

    it('takes wants the held seeds can meet', () => {
      for (const spec of [
        { type: 'count-blooming', plant: 'clover', count: 3 },
        {
          type: 'plant-near',
          plant: 'sunflower',
          count: 2,
          near: { kind: 'home' },
          withinSteps: 3,
        },
        {
          type: 'plant-near',
          plant: 'clover',
          count: 1,
          near: { kind: 'decoration', decoration: 'lamp-post' },
          withinSteps: 2,
        },
        { type: 'variety', distinct: 2, withinSteps: 3 },
      ] satisfies WantSpec[]) {
        expect({ spec, problems: wantProblems(spec, tutorial) }).toEqual({
          spec,
          problems: [],
        });
      }
    });

    it('rejects wants that need more seeds, an unheld decoration or more room', () => {
      for (const spec of [
        { type: 'count-blooming', plant: 'clover', count: 4 },
        { type: 'count-blooming', plant: 'moonflower', count: 1 },
        { type: 'place-decoration', decoration: 'pond' },
        {
          type: 'plant-near',
          plant: 'clover',
          count: 1,
          near: { kind: 'decoration', decoration: 'pond' },
          withinSteps: 3,
        },
        { type: 'variety', distinct: 3, withinSteps: 3 },
      ] satisfies WantSpec[]) {
        expect({ spec, problems: wantProblems(spec, tutorial) }).toEqual({
          spec,
          problems: [problem],
        });
      }
      expect(
        wantProblems(
          { type: 'count-blooming', plant: 'clover', count: 2 },
          { ...tutorial, maxPlants: 2, plantCount: 1 },
        ),
      ).toEqual([problem]);
    });
  });
});
