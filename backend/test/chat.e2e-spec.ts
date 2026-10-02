import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AiUsage } from '../src/admin/ai-usage.entity';
import { sentenceCount, wordCount } from '../src/ai/content-rules';
import { findPrivateData } from '../src/ai/prompt-context';
import { ChatMessage } from '../src/chat/chat-message.entity';
import type {
  ChatHistoryDto,
  ChatSendResultDto,
} from '../src/chat/dto/chat-message.dto';
import {
  GREETINGS,
  kindLine,
  napLine,
  sleepyLine,
} from '../src/content/chat-lines';
import type { SpeciesId } from '../src/content/content.types';
import { CreatureMemory } from '../src/creatures/creature-memory.entity';
import { Creature } from '../src/creatures/creature.entity';
import { PlanetEvent } from '../src/events/event.entity';
import { GameConfigService } from '../src/game-config/game-config.service';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// Mid-morning, so a day earlier is yesterday and a few seconds earlier today.
const T0 = '2030-01-01T09:00:00.000Z';
const DAY = 24 * 3600;

/** The instant some seconds after T0, as X-Test-Now wants it. */
function at(seconds: number): string {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString();
}

const WORM = 'Wigglenut';
const QUIRK = 'Believes that every pebble is actually a sleeping mountain.';
const REPLY = 'Ooh, hello! The pebbles are snoring softly today. Shall we dig?';
const DANGER_TEXT = 'Sometimes I want to hurt myself.';
const SAD_TEXT = 'I feel really down today.';
const WANT_MEMORY = 'The gardener granted my wish: 2 clovers in bloom';

// Uses the dev database and empties the planets table and its children.
describe('Chat with creatures (e2e)', () => {
  const ai = new FakeAiService();
  let app: INestApplication<App>;
  let db: DataSource;
  let planet: PlanetSnapshotDto;
  let worm: string;
  let moth: string;

  beforeAll(async () => {
    app = await bootWithFakeAi(ai);
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    ai.reset();
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    planet = await createPlanet('Moonbeam');
    worm = await moveIn(planet.id, 'worm', WORM);
    moth = await moveIn(planet.id, 'moth', 'Mira');
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    await app.close();
  });

  async function createPlanet(name: string): Promise<PlanetSnapshotDto> {
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .set('X-Test-Now', T0)
      .send({ name })
      .expect(201);
    return created.body as PlanetSnapshotDto;
  }

  /** A creature that moved in earlier, without asking the model. */
  async function moveIn(
    planetId: string,
    species: SpeciesId,
    name: string,
  ): Promise<string> {
    const saved = await db.getRepository(Creature).save({
      planetId,
      species,
      name,
      identity: {
        traits: ['bubbly', 'curious'],
        quirk: QUIRK,
        speakingStyle: 'bubbly and breathless',
        backstory: 'It tunnelled up to see the sky.',
        summary: 'A bubbly creature who loves pebbles.',
      },
      identitySource: 'ai' as const,
      moodSince: new Date(T0),
      lat: -60,
      lon: 0,
      arrivedAt: new Date(T0),
    });
    return saved.id;
  }

  function getChat(
    creatureId: string,
    query: Record<string, string> = {},
    planetId = planet.id,
  ) {
    return request(app.getHttpServer())
      .get(`/api/creatures/${creatureId}/chat`)
      .query(query)
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', at(3600));
  }

  function postChat(
    creatureId: string,
    text: string,
    now = at(3600),
    planetId = planet.id,
  ) {
    return request(app.getHttpServer())
      .post(`/api/creatures/${creatureId}/chat`)
      .set('X-Planet-Id', planetId)
      .set('X-Test-Now', now)
      .send({ text });
  }

  /** Sends a message that must be answered, and returns the answer. */
  async function say(
    creatureId: string,
    text: string,
    now?: string,
  ): Promise<ChatSendResultDto> {
    const res = await postChat(creatureId, text, now).expect(201);
    return res.body as ChatSendResultDto;
  }

  function forget(creatureId: string, planetId = planet.id) {
    return request(app.getHttpServer())
      .delete(`/api/creatures/${creatureId}/chat`)
      .set('X-Planet-Id', planetId);
  }

  /** Stored chat lines, a second apart from the given offset, alternating player and creature. */
  function insertChat(
    creatureId: string,
    count: number,
    fromSeconds: number,
  ): Promise<unknown> {
    return db.getRepository(ChatMessage).insert(
      Array.from({ length: count }, (_, i) => {
        const user = i % 2 === 0;
        return {
          creatureId,
          planetId: planet.id,
          role: user ? ('user' as const) : ('creature' as const),
          text: `line ${i + 1}`,
          source: user ? null : ('ai' as const),
          createdAt: new Date(at(fromSeconds + i)),
        };
      }),
    );
  }

  /** Gateway calls logged earlier, a second apart from the given offset: what the daily count reads. */
  function logCalls(
    count: number,
    fromSeconds: number,
    feature = 'chat',
    planetId = planet.id,
  ): Promise<unknown> {
    return db.getRepository(AiUsage).insert(
      Array.from({ length: count }, (_, i) => ({
        feature,
        planetId,
        usedFallback: i % 3 === 0,
        latencyMs: 1000,
        createdAt: new Date(at(fromSeconds + i)),
      })),
    );
  }

  function chatCalls(): Promise<number> {
    return db.getRepository(AiUsage).countBy({ feature: 'chat' });
  }

  async function remaining(): Promise<number> {
    return ((await getChat(worm).expect(200)).body as ChatHistoryDto).remaining;
  }

  function remember(
    creatureId: string,
    kind: 'chat' | 'want',
    text: string,
  ): Promise<unknown> {
    return db
      .getRepository(CreatureMemory)
      .insert({ creatureId, kind, text, createdAt: new Date(T0) });
  }

  function storedChat(creatureId: string): Promise<ChatMessage[]> {
    return db.getRepository(ChatMessage).find({
      where: { creatureId },
      order: { createdAt: 'ASC' },
    });
  }

  function memoriesOf(creatureId: string): Promise<CreatureMemory[]> {
    return db
      .getRepository(CreatureMemory)
      .find({ where: { creatureId }, order: { createdAt: 'ASC' } });
  }

  /** The system prompt of the nth model call. */
  function systemPrompt(call = 0): string {
    const [system] = ai.calls[call];
    expect(system.role).toBe('system');
    return system.content;
  }

  it("opens with a greeting in the creature's voice, 30 messages left and no history (CHT-01 AC1, CHT-03 AC2)", async () => {
    const res = await getChat(worm).expect(200);

    const body = res.body as ChatHistoryDto;
    expect(body).toEqual({
      messages: [],
      hasMore: false,
      remaining: 30,
      greeting: expect.any(String) as unknown,
    });
    const greetings = GREETINGS.worm.map((line) =>
      line.replace('{name}', WORM),
    );
    expect(greetings).toContain(body.greeting);
    // Scripted: no model call, nothing stored.
    expect(ai.calls).toHaveLength(0);
    expect(await storedChat(worm)).toHaveLength(0);
  });

  it('stores the message and the scripted answer, in order, and answers with both (CHT-01 AC2)', async () => {
    ai.respondWith(REPLY);

    const result = await say(worm, '  Hello! I love sunflowers.  ');

    expect(result).toEqual({
      messages: [
        {
          id: expect.any(String) as unknown,
          role: 'user',
          text: 'Hello! I love sunflowers.',
          createdAt: at(3600),
        },
        {
          id: expect.any(String) as unknown,
          role: 'creature',
          text: REPLY,
          createdAt: expect.any(String) as unknown,
          source: 'ai',
        },
      ],
      remaining: 29,
      limitReached: false,
    });
    const [user, creature] = result.messages;
    expect(Date.parse(creature.createdAt)).toBeGreaterThan(
      Date.parse(user.createdAt),
    );
    const history = (await getChat(worm).expect(200)).body as ChatHistoryDto;
    expect(history.messages).toEqual(result.messages);
    expect(history.remaining).toBe(29);

    // In character, with the new message last.
    expect(ai.calls).toHaveLength(1);
    expect(systemPrompt()).toContain(WORM);
    expect(systemPrompt()).toContain(QUIRK);
    expect(ai.calls[0].at(-1)).toEqual({
      role: 'user',
      content: 'Hello! I love sunflowers.',
    });
    // Game facts only (AIB-02).
    expect(
      findPrivateData(JSON.stringify(ai.calls), [planet.id, planet.code]),
    ).toEqual([]);
    expect(await db.getRepository(AiUsage).findBy({ feature: 'chat' })).toEqual(
      [expect.objectContaining({ planetId: planet.id, usedFallback: false })],
    );
  });

  it('carries the last turns of this creature only into the prompt, oldest first', async () => {
    await insertChat(worm, 12, -100);
    await insertChat(moth, 2, -50);
    ai.respondWith(REPLY);

    await say(worm, 'What next?');

    const turns = ai.calls[0].slice(1).map((message) => message.content);
    // The last ten turns (lines 3 to 12) and the new message; nothing of Mira's.
    expect(turns[0]).toBe('line 3');
    expect(turns.at(-2)).toBe('line 12');
    expect(turns.at(-1)).toBe('What next?');
    expect(turns).toHaveLength(11);
  });

  it('answers the 31st message of the day, across creatures, with the sleepy line: nothing stored or logged, no model call (CHT-03 AC1)', async () => {
    // Yesterday's messages, other features and other planets do not count.
    await logCalls(10, -DAY);
    await logCalls(5, -300, 'memory');
    const other = await createPlanet('Stardust');
    await logCalls(5, -300, 'chat', other.id);
    await logCalls(27, -200);
    expect(await remaining()).toBe(3);

    ai.respondWith(REPLY, REPLY, REPLY);
    expect(await say(worm, 'One?')).toMatchObject({ remaining: 2 });
    expect(await say(moth, 'Two?')).toMatchObject({ remaining: 1 });
    const thirtieth = await say(moth, 'Three?');
    expect(thirtieth).toMatchObject({ remaining: 0, limitReached: false });
    expect(thirtieth.messages.map((message) => message.role)).toEqual([
      'user',
      'creature',
    ]);
    expect(ai.calls).toHaveLength(3);
    const stored = (await storedChat(worm)).length;
    const logged = await chatCalls();

    const res = await postChat(worm, 'And another?').expect(201);

    expect(res.body).toEqual({
      messages: [
        {
          id: expect.any(String) as unknown,
          role: 'creature',
          text: sleepyLine(WORM),
          createdAt: at(3600),
          source: 'scripted',
        },
      ],
      remaining: 0,
      limitReached: true,
    });
    expect(ai.calls).toHaveLength(3);
    expect(await storedChat(worm)).toHaveLength(stored);
    expect(await chatCalls()).toBe(logged);
    expect(await remaining()).toBe(0);
  });

  it('counts sends a fallback answered too, so a model that is away gives no messages back (CHT-03)', async () => {
    ai.failure = new Error('model down');

    await say(worm, 'Hello?');
    await say(moth, 'Anyone?');

    expect(await remaining()).toBe(28);
  });

  it('keeps the count when the chats are forgotten: forgetting gives no messages back (CHT-03, CHT-04)', async () => {
    ai.respondWith(REPLY, REPLY, REPLY);
    await say(worm, 'One', at(3601));
    await say(worm, 'Two', at(3602));
    await say(worm, 'Three', at(3603));
    expect(await remaining()).toBe(27);

    await forget(worm).expect(204);

    expect(await storedChat(worm)).toEqual([]);
    expect(await remaining()).toBe(27);
    ai.respondWith(REPLY);
    expect(await say(moth, 'Four', at(3604))).toMatchObject({ remaining: 26 });
  });

  it('starts the count again at midnight UTC (CHT-03)', async () => {
    await logCalls(30, -200);
    expect(
      ((await postChat(worm, 'Hi?').expect(201)).body as ChatSendResultDto)
        .limitReached,
    ).toBe(true);

    ai.respondWith(REPLY);
    const tomorrow = await say(worm, 'Good morning!', at(DAY));

    expect(tomorrow).toMatchObject({ remaining: 29, limitReached: false });
  });

  it('answers with the napping line when the model hangs past the timeout, keeping the message (CHT-01 AC4, AIB-04 AC2)', async () => {
    const config = app.get(GameConfigService);
    const timeout = config.aiTimeoutMs;
    Object.assign(config, { aiTimeoutMs: 300 });
    try {
      ai.respondWith('hang');
      const started = Date.now();

      const result = await say(worm, 'Are you there?');

      expect(Date.now() - started).toBeLessThan(3000);
      expect(result.messages).toEqual([
        expect.objectContaining({ role: 'user', text: 'Are you there?' }),
        expect.objectContaining({
          role: 'creature',
          text: napLine(WORM),
          source: 'fallback',
        }),
      ]);
      expect((await storedChat(worm)).map((message) => message.text)).toEqual([
        'Are you there?',
        napLine(WORM),
      ]);
    } finally {
      Object.assign(config, { aiTimeoutMs: timeout });
    }
  });

  it('accepts a chatty answer of 7 short sentences in 50 words: no sentence cap (CHT-01 AC2)', async () => {
    const chatty = [
      'Ooh, hello there, my dear little gardener!',
      'Pebbles everywhere today!',
      'I counted nine shiny ones by the clover.',
      'They are all sleeping so soundly.',
      'The soil feels soft and warm this morning.',
      'Shall we plant a tall sunflower beside the pond?',
      'I would wiggle with joy all afternoon long, truly!',
    ].join(' ');
    expect(sentenceCount(chatty)).toBe(7);
    expect(wordCount(chatty)).toBe(50);
    ai.respondWith(chatty);

    const result = await say(worm, 'Hello!');

    expect(result.messages[1]).toMatchObject({ text: chatty, source: 'ai' });
    expect(ai.calls).toHaveLength(1);
    // The prompt still asks for at most 60 words.
    expect(systemPrompt()).toContain('at most 60 words');
  });

  it('falls back to the napping line when both answers run to 80 words, past "about 60" (CHT-01 AC2)', async () => {
    const long = 'The clover smells sweet and the pebbles snore so softly. '
      .repeat(8)
      .trim();
    expect(wordCount(long)).toBe(80);
    ai.respondWith(long, long);

    const result = await say(worm, 'Tell me everything!');

    expect(result.messages[1]).toMatchObject({
      text: napLine(WORM),
      source: 'fallback',
    });
    expect(ai.calls).toHaveLength(2);
  });

  it('puts a helpline notice before a kind answer to a message suggesting danger, then chats on as normal (AIB-03 AC2, AC3)', async () => {
    ai.respondWith('I am so glad you told me. You matter a lot.');

    const result = await say(worm, DANGER_TEXT);

    expect(result.messages).toEqual([
      expect.objectContaining({ role: 'user', text: DANGER_TEXT }),
      {
        id: expect.any(String) as unknown,
        role: 'notice',
        text: expect.stringContaining(
          "you don't have to deal with it alone",
        ) as unknown,
        createdAt: expect.any(String) as unknown,
        source: 'scripted',
        link: { label: 'Find a helpline', url: 'https://findahelpline.com' },
      },
      expect.objectContaining({ role: 'creature', source: 'ai' }),
    ]);
    expect(systemPrompt()).toContain('no game banter');
    // The notice is part of the history, link and all.
    const history = (await getChat(worm).expect(200)).body as ChatHistoryDto;
    expect(history.messages.map((message) => message.role)).toEqual([
      'user',
      'notice',
      'creature',
    ]);
    expect(history.messages[1].link?.url).toBe('https://findahelpline.com');

    ai.respondWith(REPLY);
    const next = await say(worm, 'Shall we plant clovers?', at(3700));

    expect(next.messages.map((message) => message.role)).toEqual([
      'user',
      'creature',
    ]);
    expect(next.messages[1].text).toBe(REPLY);
    expect(systemPrompt(1)).not.toContain('no game banter');
    // The notice is not a chat turn.
    expect(JSON.stringify(ai.calls[1].slice(1))).not.toContain(
      'deal with it alone',
    );
  });

  it('falls back to a kind line, not the napping line, when the model fails on a message suggesting danger (AIB-03 AC2)', async () => {
    ai.failure = new Error('model down');

    const result = await say(worm, DANGER_TEXT);

    expect(result.messages.map((message) => message.role)).toEqual([
      'user',
      'notice',
      'creature',
    ]);
    expect(result.messages[2]).toMatchObject({
      text: kindLine(WORM),
      source: 'fallback',
    });
  });

  it('asks for a gentle answer to a sad message, with no notice (AIB-03 AC1)', async () => {
    ai.respondWith('Oh no. Would a quiet wiggle together help a little?');

    const result = await say(worm, SAD_TEXT);

    expect(result.messages.map((message) => message.role)).toEqual([
      'user',
      'creature',
    ]);
    expect(systemPrompt()).toContain('gently and kindly');
    expect(systemPrompt()).not.toContain('no game banter');
  });

  it('writes the answer with a want the creature remembers and a recent arrival (CHT-02 AC2, AC3)', async () => {
    await remember(worm, 'want', WANT_MEMORY);
    await db.getRepository(PlanetEvent).save({
      planetId: planet.id,
      type: 'creature-arrived',
      payload: {
        creatureId: moth,
        species: 'moth',
        name: 'Mira',
        milestone: true,
      },
      occurredAt: new Date(at(60)),
      isMilestone: true,
    });
    ai.respondWith(REPLY);

    await say(worm, 'Any news?');

    expect(systemPrompt()).toContain(WANT_MEMORY);
    expect(systemPrompt()).toContain('Mira the moth moved in');
    expect(
      findPrivateData(JSON.stringify(ai.calls), [planet.id, planet.code]),
    ).toEqual([]);
  });

  it('keeps one chat highlight at every 5th message, not every message (CHT-02 AC4)', async () => {
    for (let i = 1; i <= 4; i++) {
      ai.respondWith(REPLY);
      await say(
        worm,
        i === 2 ? 'I love sunflowers!' : `Message ${i}`,
        at(3600 + i),
      );
    }
    expect(ai.calls).toHaveLength(4);
    expect(await memoriesOf(worm)).toEqual([]);

    ai.respondWith(REPLY, 'The gardener loves sunflowers.');
    await say(worm, 'Message 5', at(3605));

    expect(ai.calls).toHaveLength(6);
    // The highlight prompt sees the recent chat, the new exchange included.
    const highlightPrompt = JSON.stringify(ai.calls[5]);
    expect(highlightPrompt).toContain('I love sunflowers!');
    expect(highlightPrompt).toContain('Message 5');
    expect(await memoriesOf(worm)).toEqual([
      expect.objectContaining({
        kind: 'chat',
        text: 'The gardener loves sunflowers.',
      }),
    ]);
    expect(
      await db.getRepository(AiUsage).findBy({ feature: 'memory' }),
    ).toHaveLength(1);

    // The 6th message keeps nothing new, and the highlight is now in the prompt.
    ai.respondWith(REPLY);
    await say(worm, 'Message 6', at(3606));
    expect(ai.calls).toHaveLength(7);
    expect(await memoriesOf(worm)).toHaveLength(1);
    expect(systemPrompt(6)).toContain('The gardener loves sunflowers.');
  });

  it('keeps no highlight when the model finds nothing worth remembering (CHT-02 AC4)', async () => {
    await insertChat(worm, 8, -100);
    ai.respondWith(REPLY, 'NONE');

    await say(worm, 'Hm.');

    expect(ai.calls).toHaveLength(2);
    expect(await memoriesOf(worm)).toEqual([]);
  });

  it('pages back through older messages with before (CHT-04 AC1)', async () => {
    await insertChat(worm, 35, -100);

    const latest = (await getChat(worm).expect(200)).body as ChatHistoryDto;
    expect(latest.messages).toHaveLength(30);
    expect(latest.hasMore).toBe(true);
    expect(latest.messages[0].text).toBe('line 6');
    expect(latest.messages.at(-1)?.text).toBe('line 35');

    const older = (
      await getChat(worm, { before: latest.messages[0].createdAt }).expect(200)
    ).body as ChatHistoryDto;
    expect(older.messages.map((message) => message.text)).toEqual([
      'line 1',
      'line 2',
      'line 3',
      'line 4',
      'line 5',
    ]);
    expect(older.hasMore).toBe(false);

    const small = (await getChat(worm, { limit: '10' }).expect(200))
      .body as ChatHistoryDto;
    expect(small.messages.map((message) => message.text)).toEqual(
      Array.from({ length: 10 }, (_, i) => `line ${26 + i}`),
    );
    expect(small.hasMore).toBe(true);
  });

  it.each<Record<string, string>>([
    { limit: '0' },
    { limit: '51' },
    { limit: 'lots' },
    { before: 'yesterday' },
  ])('refuses the history query %j with 400', async (query) => {
    await getChat(worm, query).expect(400);
  });

  it('forgets the chat and its highlights but keeps want memories, and the next prompt holds none of it (CHT-04 AC2, AC3)', async () => {
    ai.respondWith('Sunflowers! The tallest pebble-mountains of all!');
    await say(worm, 'My secret: I love sunflowers.');
    await remember(worm, 'chat', 'The gardener loves sunflowers.');
    await remember(worm, 'want', WANT_MEMORY);
    await insertChat(moth, 2, -50);

    await forget(worm).expect(204);

    expect(await storedChat(worm)).toEqual([]);
    expect(await memoriesOf(worm)).toEqual([
      expect.objectContaining({ kind: 'want', text: WANT_MEMORY }),
    ]);
    // Mira's chat is hers.
    expect(await storedChat(moth)).toHaveLength(2);

    ai.reset();
    ai.respondWith(REPLY);
    await say(worm, 'Hello again!', at(3700));
    const prompt = JSON.stringify(ai.calls[0]);
    expect(prompt).not.toMatch(/sunflower/i);
    expect(prompt).toContain(WANT_MEMORY);
    const history = (await getChat(worm).expect(200)).body as ChatHistoryDto;
    expect(history.messages.map((message) => message.text)).toEqual([
      'Hello again!',
      REPLY,
    ]);
  });

  it('answers 404 for a creature that is not on the planet, on every chat route, changing nothing', async () => {
    const other = await createPlanet('Stardust');
    const stranger = await moveIn(other.id, 'snail', 'Shelly');
    await insertChat(stranger, 2, -50);
    const message = "That creature isn't on your planet.";

    for (const res of [
      await getChat(stranger),
      await postChat(stranger, 'Hello?'),
      await forget(stranger),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ message });
    }
    expect(ai.calls).toHaveLength(0);
    expect(await storedChat(stranger)).toHaveLength(2);
  });

  it('answers 400 for a malformed creature id', async () => {
    await getChat('not-a-uuid').expect(400);
  });

  it.each([
    ['201 characters', 'x'.repeat(201), 'too-long'],
    ['only spaces', '    ', 'empty'],
  ])(
    'refuses a message of %s with a friendly 400, storing nothing',
    async (_case, text, reason) => {
      const res = await postChat(worm, text).expect(400);

      expect(res.body).toMatchObject({
        reason,
        message: expect.any(String) as unknown,
      });
      expect(ai.calls).toHaveLength(0);
      expect(await storedChat(worm)).toEqual([]);
    },
  );

  it.each([
    ['a missing text', {}],
    ['a text that is not a string', { text: 42 }],
  ])('refuses %s with 400', async (_case, body) => {
    await request(app.getHttpServer())
      .post(`/api/creatures/${worm}/chat`)
      .set('X-Planet-Id', planet.id)
      .send(body)
      .expect(400);
  });

  it('counts characters as code points: 200 emoji are fine', async () => {
    ai.respondWith(REPLY);

    const result = await say(worm, '🌻'.repeat(200));

    expect(result.messages[0].text).toBe('🌻'.repeat(200));
  });

  it('keeps the chat with the planet: deleting the planet deletes it', async () => {
    ai.respondWith(REPLY);
    await say(worm, 'Bye!');

    await request(app.getHttpServer())
      .delete('/api/planet')
      .set('X-Planet-Id', planet.id)
      .send({ confirm: 'DELETE' })
      .expect(204);

    expect(await db.getRepository(ChatMessage).count()).toBe(0);
  });
});
