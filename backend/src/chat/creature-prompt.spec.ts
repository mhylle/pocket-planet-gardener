import {
  findPrivateData,
  toPlanetPublicState,
  toPublicEvents,
} from '../ai/prompt-context';
import type { CreatureIdentity } from '../creatures/identity.types';
import {
  buildChatMessages,
  buildHighlightMessages,
  CHAT_HISTORY_TURNS,
  NO_HIGHLIGHT,
  type ChatPromptInput,
  type ChatTurn,
} from './creature-prompt';

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
  decorations: [{ id: creatureId, type: 'lamp-post', lat: 7, lon: 8 }],
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

const events = toPublicEvents([
  {
    type: 'creature-arrived',
    occurredAt: new Date('2026-10-01T09:00:00Z'),
    payload: { species: 'snail', name: 'Bo', creatureId, lat: 12.5 },
  },
  {
    type: 'plant-bloomed',
    occurredAt: '2026-10-01T08:00:00.000Z',
    payload: { type: 'clover', plantId: creatureId },
  },
]);

function input(overrides: Partial<ChatPromptInput> = {}): ChatPromptInput {
  return {
    species: 'moth',
    identity,
    mood: 'cheerful',
    wistful: false,
    memories: ['The gardener loves sunflowers.', 'Mira was given a lamp-post.'],
    recentEvents: events,
    planet: toPlanetPublicState(tempting),
    history: [
      { role: 'user', text: 'Hello Mira!' },
      { role: 'creature', text: 'Greetings, gardener. One is delighted.' },
    ],
    userText: 'Do you like the lamp-post?',
    distress: 'none',
    maxWords: 60,
    ...overrides,
  };
}

function system(overrides: Partial<ChatPromptInput> = {}): string {
  return buildChatMessages(input(overrides))[0].content;
}

describe('buildChatMessages', () => {
  it('builds the same prompt for the same input', () => {
    expect(buildChatMessages(input())).toMatchSnapshot();
  });

  it('sends the system prompt, the chat so far and the new message', () => {
    expect(buildChatMessages(input()).map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(buildChatMessages(input()).at(-1)?.content).toBe(
      'Do you like the lamp-post?',
    );
  });

  it('tells the model who the creature is (AIB-07 AC1)', () => {
    const prompt = system();
    for (const fact of [
      'You are Mira, a moth',
      'Traits: dramatic, refined.',
      'Quirk: She calls every lamp a moon.',
      'Speaking style: grand, speaks of herself as one.',
      'Backstory: Mira arrived at dusk.',
      'About moths: Drawn to lamp-posts and moonflowers.',
      'Mood: cheerful.',
    ]) {
      expect(prompt).toContain(fact);
    }
    expect(prompt).not.toContain('wistful, because');
    expect(system({ wistful: true })).toContain(
      'Mood: cheerful, and a bit wistful, because something you love is missing from the planet.',
    );
  });

  it('includes every memory, the planet news and the planet (CHT-02)', () => {
    const prompt = system();
    expect(prompt).toContain(
      'What you remember, newest first:\n- The gardener loves sunflowers.\n- Mira was given a lamp-post.',
    );
    expect(prompt).toContain('- Bo the snail moved in.');
    expect(prompt).toContain('- clover bloomed.');
    expect(prompt).toContain(
      'Plants: 1 clover (bloom), 1 moonflower (sprout).',
    );
    expect(prompt).toContain('Decorations: 1 lamp-post.');
    expect(prompt).toContain('Other creatures: Bo the snail: Slow. Pen pal.');
    expect(system({ memories: [], recentEvents: [] })).toContain(
      'What you remember, newest first:\nNothing special yet.\n\nRecent news on the planet:\nNothing new lately.',
    );
  });

  it('embeds the content and tone rules (SD section 10, CHT-01 AC2 and AC5)', () => {
    const prompt = system({ maxWords: 42 });
    for (const rule of [
      'Stay in character as Mira the moth',
      'Warm, kind, playful and a little absurd',
      'all ages',
      'at most 42 words',
      'a snail does not fly, a moth likes lamps',
      'never make up plants, creatures or events',
      'Never claim to be a real person or a real animal',
      'you live on a tiny planet in a game',
      'Never ask for personal information: no real names, ages, where someone lives, schools, contact details or photos',
      'no advice about real-world matters such as health, money, legal questions or homework',
      'steer the chat back to the planet in a playful way',
      'Never mention real people, real places or brands',
      'No violence, nothing scary, no romance, no swearing, no alcohol, no drugs, no politics and no religion',
      'Never guilt-trip',
      'never pressure the gardener to play more',
      'English',
    ]) {
      expect(prompt).toContain(rule);
    }
  });

  it('adds the gentle directive only for a sad player (AIB-03 AC1)', () => {
    const sad = system({ distress: 'sad' });
    expect(sad).toContain('make no jokes about how they feel');
    expect(sad).not.toContain('someone they trust');
    expect(system()).not.toContain('Right now:');
  });

  it('adds the calm directive only for a player in danger (AIB-03 AC2)', () => {
    const danger = system({ distress: 'danger' });
    expect(danger).toContain('no jokes and no game banter');
    expect(danger).toContain('talk to someone they trust');
    expect(danger).toContain('give no links or phone numbers');
    expect(danger).not.toContain('make no jokes about how they feel');
    expect(system({ distress: 'sad' })).not.toContain('no game banter');
  });

  it('keeps the last turns, alternating and starting with the player', () => {
    const many: ChatTurn[] = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'creature',
      text: `turn ${index}`,
    }));
    const messages = buildChatMessages(input({ history: many })).slice(1);
    expect(messages).toHaveLength(CHAT_HISTORY_TURNS + 1);
    expect(messages[0]).toEqual({ role: 'user', content: 'turn 4' });
    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: 'Do you like the lamp-post?',
    });

    const unanswered = buildChatMessages(
      input({
        history: [
          { role: 'creature', text: 'An old line.' },
          { role: 'user', text: 'Are you there?' },
        ],
      }),
    ).slice(1);
    expect(unanswered).toEqual([
      {
        role: 'user',
        content: 'Are you there?\nDo you like the lamp-post?',
      },
    ]);
  });

  it('leaks no id, code or address (AIB-02)', () => {
    const json = JSON.stringify(
      buildChatMessages(
        input({
          memories: [`Pen pal ${otherPlanetId}`, 'Mail kid@example.com'],
          history: [
            { role: 'user', text: `My planet is ${planetId}` },
            { role: 'creature', text: 'How grand.' },
            { role: 'user', text: 'write to kid@example.com' },
          ],
          userText: `kid@example.com ${creatureId}`,
        }),
      ),
    );
    expect(
      findPrivateData(json, [planetId, otherPlanetId, creatureId, code]),
    ).toEqual([]);
    expect(json).not.toContain('12.5');
  });
});

describe('buildHighlightMessages', () => {
  const history: ChatTurn[] = [
    { role: 'user', text: 'I love sunflowers!' },
    { role: 'creature', text: 'One adores them too.' },
    { role: 'user', text: `Mail me at kid@example.com, ${planetId}` },
  ];

  it('asks for one short third-person highlight or NONE (CHT-02 AC4)', () => {
    const [rules, chat] = buildHighlightMessages({ identity, history });
    expect(rules.role).toBe('system');
    for (const rule of [
      'ONE short sentence in the third person',
      'The gardener loves sunflowers.',
      'At most 15 words',
      'Never include personal information',
      'Nothing about worries or sad feelings',
      `answer ${NO_HIGHLIGHT}`,
    ]) {
      expect(rules.content).toContain(rule);
    }
    expect(chat).toEqual({
      role: 'user',
      content:
        'The chat, oldest first:\nGardener: I love sunflowers!\nMira: One adores them too.\nGardener: Mail me at\n\nWrite the highlight.',
    });
  });

  it('leaks no id or address (AIB-02)', () => {
    const json = JSON.stringify(buildHighlightMessages({ identity, history }));
    expect(findPrivateData(json, [planetId, code])).toEqual([]);
  });
});
