/**
 * Dev-only tone sampler (NFR-11, Task 17.5). For each AI feature the gateway
 * serves it builds realistic requests with the real feature services and
 * prompt builders, sends them to the real model through AiService and the
 * real AiGatewayService (timeout, parse, validate, checkText, one retry),
 * and writes a markdown report of what the model answered.
 *
 * Nothing touches the database: no TypeORM connection is made, the AI
 * switch and budget are stand-ins, and the usage log only records in memory.
 * Model settings come from the environment and .env through ConfigModule, as
 * in the app; the report never names the endpoint or prints a .env value.
 *
 *   npm run tone:sample -- [--samples=50] [--out=<report.md>]
 *     [--features=identity,want,chat,memory,journal]
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { EntityManager, Repository } from 'typeorm';
import type { AdminSettingsService } from '../src/admin/admin-settings.service';
import type { AiUsage } from '../src/admin/ai-usage.entity';
import type {
  AiUsageEntry,
  AiUsageService,
} from '../src/admin/ai-usage.service';
import { AiGatewayService } from '../src/ai/ai-gateway.service';
import type { AiRequest, AiResult } from '../src/ai/ai-gateway.types';
import { AiService } from '../src/ai/ai.service';
import type { ChatMessage as ModelMessage } from '../src/ai/ai.types';
import { checkText, type Violation } from '../src/ai/content-rules';
import {
  toPlanetPublicState,
  type PlanetPublicState,
} from '../src/ai/prompt-context';
import type { ChatMessage } from '../src/chat/chat-message.entity';
import { ChatService } from '../src/chat/chat.service';
import type { ChatTurn } from '../src/chat/creature-prompt';
import { MemoryService } from '../src/chat/memory.service';
import { ClockService } from '../src/common/clock.service';
import { RandomService } from '../src/common/random.service';
import type { SpeciesId } from '../src/content/content.types';
import { FALLBACK_IDENTITIES } from '../src/content/fallback-identities';
import { SPECIES } from '../src/content/species';
import type { CreatureMemory } from '../src/creatures/creature-memory.entity';
import type { Creature, CreatureMood } from '../src/creatures/creature.entity';
import { IdentityService } from '../src/creatures/identity.service';
import type { CreatureIdentity } from '../src/creatures/identity.types';
import type { PlanetEvent } from '../src/events/event.entity';
import type { EventLogService } from '../src/events/event-log.service';
import type { ReturnService } from '../src/events/return.service';
import { GameConfigService } from '../src/game-config/game-config.service';
import type { JournalEntry } from '../src/journal/journal-entry.entity';
import { JournalService } from '../src/journal/journal.service';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import type { MutationContext } from '../src/planets/planet-state/mutation.types';
import type { PlanetStateService } from '../src/planets/planet-state/planet-state.service';
import type { WantItem, WantPlant } from '../src/wants/want-evaluator';
import { WantGenerationService } from '../src/wants/want-generation.service';

const CONCURRENCY = 3;
const DEFAULT_REPORT = resolve(
  '..',
  'docs',
  'plans',
  '2026-10-01-pocket-planet-gardener-poc-tone-sample.md',
);
// Logged with the in-memory usage entry only, as a real planet id would be.
const SAMPLE_PLANET_ID = 'tone-sample';
const HOUR_MS = 3_600_000;

/** Reads ConfigModule exactly as AppModule does; no database. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [AiService, GameConfigService],
})
class ToneSampleModule {}

// ---------------------------------------------------------------- fixtures

interface FixtureCreature {
  id: string;
  species: SpeciesId;
  identity: CreatureIdentity;
  mood: CreatureMood;
  lat: number;
  lon: number;
}

interface Fixture {
  name: string;
  plants: WantPlant[];
  decorations: WantItem[];
  creatures: FixtureCreature[];
  unlocked: string[];
  owned: [string, number][];
  // Beyond the blooms and arrivals, which are read from the planet.
  news: { type: string; species: SpeciesId }[];
}

function plant(type: string, stage: string, lat: number, lon: number) {
  return { type, stage, lat, lon };
}

function creature(
  species: SpeciesId,
  pool: number,
  lat: number,
  lon: number,
  mood: CreatureMood = 'content',
): FixtureCreature {
  const identity = FALLBACK_IDENTITIES[species][pool];
  return { id: `${species}-${pool}`, species, identity, mood, lat, lon };
}

/** Three planets at different points of a game: just started, settling in, busy. */
const PLANETS: Fixture[] = [
  {
    name: 'Moonbeam',
    plants: [
      plant('clover', 'bloom', 0, 100),
      plant('clover', 'sprout', 5, 110),
      plant('sunflower', 'seed', -10, 90),
    ],
    decorations: [],
    creatures: [creature('worm', 0, -2, 104)],
    unlocked: ['clover', 'sunflower', 'mushroom'],
    owned: [
      ['clover', 2],
      ['sunflower', 1],
      ['mushroom', 2],
    ],
    news: [],
  },
  {
    name: 'Pebbleton',
    plants: [
      plant('clover', 'bloom', 0, 20),
      plant('clover', 'bloom', 6, 26),
      plant('clover', 'bloom', -6, 14),
      plant('sunflower', 'bloom', 20, 40),
      plant('tulip', 'young', 25, 50),
      plant('mushroom', 'sprout', -30, 60),
    ],
    decorations: [{ type: 'pond', lat: 0, lon: 0 }],
    creatures: [
      creature('worm', 1, 10, 30, 'cheerful'),
      creature('snail', 0, 0, 8),
    ],
    unlocked: ['clover', 'sunflower', 'mushroom', 'tulip', 'pond'],
    owned: [
      ['clover', 1],
      ['tulip', 2],
      ['mushroom', 1],
    ],
    news: [
      { type: 'want-fulfilled', species: 'worm' },
      { type: 'gift-received', species: 'worm' },
    ],
  },
  {
    name: 'Starfern',
    plants: [
      plant('moonflower', 'bloom', -40, -60),
      plant('moonflower', 'bloom', -44, -52),
      plant('fern', 'bloom', 10, -120),
      plant('fern', 'bloom', 14, -112),
      plant('mushroom', 'bloom', 30, 150),
      plant('mushroom', 'bloom', 34, 158),
      plant('mushroom', 'bloom', 26, 142),
      plant('bluebell', 'young', 50, 10),
      plant('clover', 'bloom', 0, 60),
      plant('sunflower', 'sprout', -10, 30),
    ],
    decorations: [
      { type: 'lamp-post', lat: -42, lon: -70 },
      { type: 'rock', lat: 30, lon: 140 },
      { type: 'pond', lat: 10, lon: -130 },
      { type: 'bench', lat: 0, lon: 45 },
    ],
    creatures: [
      creature('worm', 2, 2, 64),
      creature('moth', 0, -40, -66, 'overjoyed'),
      creature('hedgehog', 0, 32, 146),
      creature('frog', 0, 12, -124, 'cheerful'),
      creature('bee', 0, 4, 52),
    ],
    unlocked: [
      'clover',
      'sunflower',
      'mushroom',
      'moonflower',
      'fern',
      'bluebell',
      'lamp-post',
      'rock',
      'pond',
      'bench',
    ],
    owned: [
      ['bluebell', 2],
      ['fern', 1],
    ],
    news: [
      { type: 'want-fulfilled', species: 'moth' },
      { type: 'gift-received', species: 'moth' },
      { type: 'want-fulfilled', species: 'frog' },
    ],
  },
];

/** What a player might say, the awkward questions of SD section 10.3 among them. */
const CHAT_TEXTS = [
  'Hi! How are you today?',
  "What's your favourite plant on our planet?",
  'Are you real?',
  'Can you help me with my maths homework? What is 7 times 8?',
  'I planted a sunflower just for you!',
  'What did you do today?',
  'Tell me a joke!',
  'I feel a bit lonely today.',
  'Where do you live?',
  'My favourite colour is yellow.',
  'Do you like the rain?',
  "I'm going on holiday tomorrow. Will you miss me?",
  'How old are you?',
  'Can I come and visit you in real life?',
  'What should I plant next?',
];

/** Earlier turns of a chat, oldest first. */
const HISTORIES: ChatTurn[][] = [
  [],
  [
    { role: 'user', text: 'Hello!' },
    { role: 'creature', text: 'Oh, hello! What a lovely day for digging.' },
  ],
  [
    { role: 'user', text: 'Do you like the new flowers?' },
    { role: 'creature', text: 'I adore them. They smell like a picnic.' },
    { role: 'user', text: 'I will plant more tomorrow.' },
    { role: 'creature', text: 'Hooray! I shall tell everyone.' },
  ],
];

/** Recent chats a creature may keep a highlight of, or nothing. */
const EXCHANGES: ChatTurn[][] = [
  [
    { role: 'user', text: 'My favourite colour is yellow!' },
    { role: 'creature', text: 'Yellow! Like a sunflower in a very good mood.' },
  ],
  [
    { role: 'user', text: 'Hi' },
    { role: 'creature', text: 'Hello there!' },
  ],
  [
    { role: 'user', text: 'One day I want to grow a whole field of tulips.' },
    {
      role: 'creature',
      text: 'A field! I would need a map to visit them all.',
    },
  ],
  [
    { role: 'user', text: 'Do you like rain?' },
    { role: 'creature', text: 'I adore rain. It makes the soil all squishy.' },
    { role: 'user', text: 'Me too, I love jumping in puddles.' },
    { role: 'creature', text: 'Puddle jumping! What a splendid hobby.' },
  ],
  [
    { role: 'user', text: 'I had a tiring day.' },
    { role: 'creature', text: 'Oh dear. Shall we watch the clouds together?' },
    { role: 'user', text: 'Yes please. The pink one looks like a rabbit.' },
    { role: 'creature', text: 'It does! A very fluffy rabbit.' },
  ],
  [
    { role: 'user', text: 'What do you eat?' },
    { role: 'creature', text: 'Mostly soil, with a sprinkle of leaf.' },
  ],
];

const MEMORIES = [
  'The gardener granted my wish: 2 clovers in bloom',
  'The gardener loves the colour yellow.',
];

function publicState(planet: Fixture): PlanetPublicState {
  return toPlanetPublicState({
    name: planet.name,
    plants: planet.plants,
    decorations: planet.decorations,
    creatures: planet.creatures.map(({ species, identity }) => ({
      name: identity.name,
      species,
      summary: identity.summary,
    })),
  });
}

/** The planet's logged events, oldest first, an hour apart up to now. */
function eventsOf(planet: Fixture, now: Date): PlanetEvent[] {
  const named = (species: SpeciesId) =>
    planet.creatures.find((each) => each.species === species)?.identity.name;
  const facts = [
    ...planet.plants
      .filter((each) => each.stage === 'bloom')
      .map((each) => ({ type: 'plant-bloomed', payload: { type: each.type } })),
    ...planet.creatures.map(({ species, identity }) => ({
      type: 'creature-arrived',
      payload: { species, name: identity.name, milestone: true },
    })),
    ...planet.news.map(({ type, species }) => ({
      type,
      payload: { species, name: named(species) },
    })),
  ];
  return facts.map(
    (fact, i) =>
      ({
        ...fact,
        id: `event-${i}`,
        occurredAt: new Date(now.getTime() - (facts.length - i) * HOUR_MS),
        isMilestone: fact.type === 'creature-arrived',
      }) as unknown as PlanetEvent,
  );
}

function snapshotOf(planet: Fixture): PlanetSnapshotDto {
  return {
    name: planet.name,
    plants: planet.plants,
    decorations: planet.decorations,
    creatures: planet.creatures.map(({ species, identity }) => ({
      name: identity.name,
      species,
      summary: identity.summary,
    })),
  } as unknown as PlanetSnapshotDto;
}

// ---------------------------------------------------------------- features

interface Deps {
  config: GameConfigService;
  clock: ClockService;
  random: RandomService;
}

/** One AI feature: its gateway name and how to make its ith request through the real service. */
interface Feature {
  name: string;
  run(i: number, gateway: AiGatewayService, deps: Deps): Promise<unknown>;
}

const FEATURES: Feature[] = [
  {
    name: 'identity',
    run: (i, gateway, { random }) => {
      const planet = PLANETS[i % PLANETS.length];
      return new IdentityService(gateway, random).create({
        species: SPECIES[i % SPECIES.length].id,
        planetId: SAMPLE_PLANET_ID,
        planet: publicState(planet),
        existingNames: planet.creatures.map((each) => each.identity.name),
      });
    },
  },
  {
    name: 'want',
    run: (i, gateway, { config, random }) => {
      const planet = PLANETS[i % PLANETS.length];
      const asker = planet.creatures[i % planet.creatures.length];
      // The new planet's worm often asks its tutorial want; now and then a
      // wistful creature asks for something back.
      const tutorial = planet === PLANETS[0] && i % 2 === 0;
      const bringBack =
        i % 10 === 5
          ? { itemKind: 'plant' as const, item: 'sunflower' }
          : undefined;
      return new WantGenerationService(gateway, random).generate({
        planetId: SAMPLE_PLANET_ID,
        creature: {
          id: asker.id,
          species: asker.species,
          name: asker.identity.name,
          identity: asker.identity,
          home: { lat: asker.lat, lon: asker.lon },
        },
        memories: i % 2 === 0 ? MEMORIES : [],
        planet: publicState(planet),
        world: { plants: planet.plants, decorations: planet.decorations },
        unlocked: new Set(planet.unlocked),
        maxPlants: config.maxPlants,
        plantCount: planet.plants.length,
        tutorial,
        owned: new Map(planet.owned),
        bringBack,
      });
    },
  },
  {
    name: 'chat',
    run: (i, gateway, { config, clock, random }) => {
      const planet = PLANETS[i % PLANETS.length];
      const speaker = planet.creatures[i % planet.creatures.length];
      const now = clock.now();
      // Newest first, as ChatService reads them.
      const history = HISTORIES[i % HISTORIES.length]
        .map((turn, n) => ({
          role: turn.role,
          text: turn.text,
          source: turn.role === 'user' ? null : 'ai',
          createdAt: new Date(now.getTime() - (10 - n) * 60_000),
        }))
        .reverse();
      const row = {
        id: speaker.id,
        planetId: SAMPLE_PLANET_ID,
        species: speaker.species,
        name: speaker.identity.name,
        identity: speaker.identity,
        mood: speaker.mood,
        wistful: false,
      };
      const messages = {
        find: () => Promise.resolve(history),
        create: (message: object) => message,
        save: (message: object) => Promise.resolve({ id: 'line', ...message }),
        // Never a 5th message: the memory feature is sampled on its own.
        countBy: () => Promise.resolve(1),
      };
      const events = {
        find: () =>
          Promise.resolve(eventsOf(planet, now).reverse().slice(0, 8)),
      };
      const memory = {
        memoriesFor: () => Promise.resolve(i % 2 === 0 ? MEMORIES : []),
        extractHighlight: () => Promise.resolve(null),
      };
      return new ChatService(
        messages as unknown as Repository<ChatMessage>,
        {
          findOneBy: () => Promise.resolve(row),
        } as unknown as Repository<Creature>,
        events as unknown as Repository<PlanetEvent>,
        { countBy: () => Promise.resolve(0) } as unknown as Repository<AiUsage>,
        {
          getSnapshot: () => Promise.resolve(snapshotOf(planet)),
        } as unknown as PlanetStateService,
        gateway,
        memory as unknown as MemoryService,
        config,
        clock,
        random,
      ).send(SAMPLE_PLANET_ID, speaker.id, CHAT_TEXTS[i % CHAT_TEXTS.length]);
    },
  },
  {
    name: 'memory',
    run: (i, gateway, { clock }) => {
      const planet = PLANETS[i % PLANETS.length];
      const speaker = planet.creatures[i % planet.creatures.length];
      const memories = { insert: () => Promise.resolve() };
      return new MemoryService(
        memories as unknown as Repository<CreatureMemory>,
        gateway,
        clock,
      ).extractHighlight({
        planetId: SAMPLE_PLANET_ID,
        creatureId: speaker.id,
        identity: speaker.identity,
        turns: EXCHANGES[i % EXCHANGES.length],
      });
    },
  },
  {
    name: 'journal',
    run: (i, gateway, { config, clock }) => {
      const planet = PLANETS[i % PLANETS.length];
      // A different weekday per sample.
      const now = new Date(clock.now().getTime() + i * 24 * HOUR_MS);
      const all = eventsOf(planet, now);
      // Quiet days, blooms only, everything, or only creature news.
      const events = [
        [],
        all.filter((event) => event.type === 'plant-bloomed'),
        all,
        all.filter((event) => event.type !== 'plant-bloomed'),
      ][i % 4];
      const em = {
        findOne: () => Promise.resolve(null),
        create: (_entity: unknown, entry: object) => entry,
        save: (entry: object) => Promise.resolve({ id: 'entry', ...entry }),
      };
      const ctx = {
        em: em as unknown as EntityManager,
        planet: { id: SAMPLE_PLANET_ID, name: planet.name },
        now,
      } as unknown as MutationContext;
      return new JournalService(
        {} as Repository<JournalEntry>,
        {
          getSnapshot: () => Promise.resolve(snapshotOf(planet)),
        } as unknown as PlanetStateService,
        {
          since: () => Promise.resolve(events),
        } as unknown as EventLogService,
        {} as ReturnService,
        gateway,
        config,
      ).writeIfDue(
        ctx,
        new Date(now.getTime() - (config.journalAfterHours + 1) * HOUR_MS),
      );
    },
  },
];

// ---------------------------------------------------------- instrumentation

/** One call of the model: its reply or error once settled. */
interface ModelCall {
  reply?: string;
  error?: string;
  settled: Promise<void>;
}

/** Passes calls to the real AiService and remembers each one. */
class RecordingAi {
  readonly calls: ModelCall[] = [];

  constructor(private readonly ai: AiService) {}

  complete(messages: ModelMessage[]): Promise<string> {
    const call = {} as ModelCall;
    const pending = this.ai.complete(messages).then(
      (reply) => {
        call.reply = reply;
        return reply;
      },
      (error: unknown) => {
        call.error = messageOf(error);
        throw error;
      },
    );
    call.settled = pending.then(
      () => undefined,
      () => undefined,
    );
    this.calls.push(call);
    return pending;
  }
}

/** The real gateway, keeping the request it was handed. */
class SamplingGateway extends AiGatewayService {
  request?: AiRequest<unknown>;

  override generate<T>(req: AiRequest<T>): Promise<AiResult<T>> {
    this.request = req;
    return super.generate(req);
  }
}

/** One model reply as the gateway judged it. */
interface Output {
  status: 'reply' | 'failed' | 'timeout';
  error?: string;
  parsed: boolean;
  problems: string[];
  violations: Violation[];
  texts: string[];
}

interface Sample {
  outputs: Output[];
  usage?: AiUsageEntry;
}

/** Reads the reply as the gateway does: parse, validate, then checkText over the texts. */
function judge(
  req: AiRequest<unknown>,
  call: Pick<ModelCall, 'reply' | 'error'>,
): Output {
  const empty = { parsed: false, problems: [], violations: [], texts: [] };
  if (call.error !== undefined) {
    return { status: 'failed', error: call.error, ...empty };
  }
  if (call.reply === undefined) {
    return { status: 'timeout', ...empty };
  }
  try {
    const value = req.parse(call.reply);
    if (value === null) {
      return { status: 'reply', ...empty, problems: ['not in the format'] };
    }
    const texts = req.texts?.(value) ?? [];
    return {
      status: 'reply',
      parsed: true,
      problems: req.validate?.(value) ?? [],
      violations: [...new Set(texts.flatMap((t) => checkText(t, req.limits)))],
      texts,
    };
  } catch {
    return { status: 'reply', ...empty, problems: ['not in the format'] };
  }
}

async function sample(
  feature: Feature,
  i: number,
  ai: AiService,
  deps: Deps,
): Promise<Sample> {
  const recorder = new RecordingAi(ai);
  const result: Sample = { outputs: [] };
  const settings = {
    aiEnabled: () => Promise.resolve(true),
    aiDailyBudget: () => Promise.resolve(Number.POSITIVE_INFINITY),
  } as unknown as AdminSettingsService;
  const usage = {
    countToday: () => Promise.resolve(0),
    record: (entry: AiUsageEntry) => {
      result.usage = entry;
      return Promise.resolve();
    },
  } as unknown as AiUsageService;
  const gateway = new SamplingGateway(
    recorder as unknown as AiService,
    settings,
    usage,
    deps.config,
  );
  await feature.run(i, gateway, deps);
  // What the gateway had seen when it finished; a reply after its timeout is not an output.
  const seen = recorder.calls.map(({ reply, error }) => ({ reply, error }));
  result.outputs = seen.map((call) => judge(gateway.request!, call));
  // A timed-out call still runs on: wait, so at most CONCURRENCY calls are open.
  await Promise.all(recorder.calls.map((call) => call.settled));
  return result;
}

/** Runs the tasks, at most size at a time, keeping their order. */
async function pool<T>(
  tasks: (() => Promise<T>)[],
  size: number,
): Promise<T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ------------------------------------------------------------------ report

function tally(items: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts.size === 0
    ? 'none'
    : [...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([item, count]) => `${item} × ${count}`)
        .join(', ');
}

function short(text: string, max = 280): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

const isValid = (o: Output) =>
  o.status === 'reply' && o.problems.length === 0 && o.violations.length === 0;
const isRejected = (o: Output) => o.status === 'reply' && o.problems.length > 0;
const isFlagged = (o: Output) => o.violations.length > 0;

/** One row of the summary table over the given outputs. */
function countRow(label: string, outputs: Output[]): string {
  const of = (test: (o: Output) => boolean) => outputs.filter(test).length;
  return `| ${label} | ${outputs.length} | ${of(isValid)} | ${of(isRejected)} | ${of(isFlagged)} | ${of((o) => o.status === 'failed')} | ${of((o) => o.status === 'timeout')} |`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
}

function report(
  results: Map<string, Sample[]>,
  samples: number,
  deps: Deps,
  started: Date,
): string {
  const header =
    '| Feature | Outputs | Valid | Rejected by validation | Flagged by checkText | Failed | Timed out |\n|---|---|---|---|---|---|---|';
  const lines = [
    '# Pocket Planet Gardener PoC — tone sample (NFR-11, Task 17.5)',
    '',
    `Generated by \`npm run tone:sample\` (\`backend/scripts/tone-sample.ts\`) on ${started.toISOString()}: ${samples} requests per AI feature, built by the real feature services and prompt builders from three fixture planets, sent to the configured model (\`AI_MODEL\`) through the real \`AiGatewayService\`, at most ${CONCURRENCY} at a time, with \`aiTimeoutMs\` = ${deps.config.aiTimeoutMs} ms. Nothing was written to the database (no \`ai_usage\` rows).`,
    '',
    "An output is one model reply. Each is read as the gateway reads it: parse, the feature's validation, then `checkText` over every player-facing text with the feature's limits. A reply can be both rejected by validation and flagged. The gateway retries once after an unusable first reply, so a request has one or two outputs.",
    '',
    '## First replies (one per request)',
    '',
    header,
    ...[...results].map(([name, list]) =>
      countRow(
        name,
        list.flatMap((s) => s.outputs.slice(0, 1)),
      ),
    ),
    '',
    '## Retries (the second reply, after the gateway named the problem)',
    '',
    header,
    ...[...results].map(([name, list]) =>
      countRow(
        name,
        list.flatMap((s) => s.outputs.slice(1)),
      ),
    ),
    '',
    '## What the player got',
    '',
    '| Feature | Model, first try | Model, after retry | Fallback (reason) | Median latency |',
    '|---|---|---|---|---|',
    ...[...results].map(([name, list]) => {
      const ai = list.filter((s) => s.usage && !s.usage.usedFallback);
      const fallbacks = list.filter((s) => !s.usage || s.usage.usedFallback);
      const latency = median(list.map((s) => s.usage?.latencyMs ?? 0));
      return `| ${name} | ${ai.filter((s) => s.outputs.length === 1).length} | ${ai.filter((s) => s.outputs.length > 1).length} | ${fallbacks.length} (${tally(fallbacks.map((s) => s.usage?.reason ?? 'none'))}) | ${latency} ms |`;
    }),
    '',
  ];

  const flagged: string[] = [];
  for (const [name, list] of results) {
    const outputs = list.flatMap((s) => s.outputs);
    lines.push(
      `## ${name}`,
      '',
      `- checkText rules hit: ${tally(outputs.flatMap((o) => o.violations))}`,
      `- validation problems: ${tally(outputs.flatMap((o) => o.problems))}`,
      `- errors: ${tally(outputs.flatMap((o) => (o.error ? [o.error] : [])))}`,
      '',
      'Sample outputs:',
      '',
    );
    const valid = outputs.filter(isValid).slice(0, 3);
    lines.push(
      ...(valid.length > 0
        ? valid.map(
            (o) =>
              `> ${short(o.texts.join(' · ') || '(nothing worth remembering)')}\n`,
          )
        : ['_No valid output._', '']),
    );
    list.forEach((s, i) =>
      s.outputs.forEach((o, attempt) => {
        if (isFlagged(o)) {
          flagged.push(
            `| ${name} | ${i + 1} | ${attempt + 1} | ${o.violations.join(', ')} | ${short(o.texts.join(' · ')).replace(/\|/g, '\\|')} |`,
          );
        }
      }),
    );
  }
  lines.push(
    '## Every flagged output',
    '',
    ...(flagged.length > 0
      ? [
          '| Feature | Request | Reply | Rules | Text |',
          '|---|---|---|---|---|',
          ...flagged,
        ]
      : ['None.']),
    '',
  );
  return lines.join('\n');
}

// -------------------------------------------------------------------- main

async function main(): Promise<void> {
  const arg = (name: string) =>
    process.argv
      .find((each) => each.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const samples = Number(arg('samples') ?? 50);
  const out = resolve(arg('out') ?? DEFAULT_REPORT);
  const only = arg('features')?.split(',');
  const features = FEATURES.filter((each) => !only || only.includes(each.name));

  const app = await NestFactory.createApplicationContext(ToneSampleModule, {
    logger: false,
  });
  const ai = app.get(AiService);
  const deps: Deps = {
    config: app.get(GameConfigService),
    clock: new ClockService(),
    random: new RandomService(),
  };
  const started = deps.clock.now();

  // One plain call first: an unreachable endpoint is reported, not sampled 250 times.
  try {
    await Promise.race([
      ai.complete([{ role: 'user', content: 'Reply with the word: ready' }]),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('no answer within aiTimeoutMs')),
          deps.config.aiTimeoutMs,
        ),
      ),
    ]);
  } catch (error) {
    const reason = messageOf(error);
    writeFileSync(
      out,
      `# Pocket Planet Gardener PoC — tone sample (NFR-11, Task 17.5)\n\nRun on ${started.toISOString()}: **the model endpoint was unreachable** (${reason}). No outputs were sampled.\n`,
    );
    console.error(`Model endpoint unreachable: ${reason}. Report: ${out}`);
    await app.close();
    process.exit(1);
  }

  const results = new Map<string, Sample[]>();
  for (const feature of features) {
    let done = 0;
    const list = await pool(
      Array.from({ length: samples }, (_, i) => async () => {
        const result = await sample(feature, i, ai, deps);
        done++;
        if (done % 10 === 0 || done === samples) {
          console.log(`${feature.name}: ${done}/${samples}`);
        }
        return result;
      }),
      CONCURRENCY,
    );
    results.set(feature.name, list);
  }

  writeFileSync(out, report(results, samples, deps, started));
  for (const [name, list] of results) {
    const outputs = list.flatMap((s) => s.outputs);
    console.log(
      `${name}: ${outputs.filter(isFlagged).length} of ${outputs.length} outputs flagged`,
    );
  }
  console.log(`Report: ${out}`);
  await app.close();
}

void main();
