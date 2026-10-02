import { Logger } from '@nestjs/common';
import { FakeAiService } from '../../test/support/fake-ai';
import type { AdminSettingsService } from '../admin/admin-settings.service';
import type { AiUsageEntry, AiUsageService } from '../admin/ai-usage.service';
import type { GameConfigService } from '../game-config/game-config.service';
import { AiGatewayService, extractJson } from './ai-gateway.service';
import type { AiRequest } from './ai-gateway.types';
import type { AiService } from './ai.service';

// The failure cases log on purpose; keep that out of the test output.
beforeAll(() => {
  Logger.overrideLogger(false);
});

// Short, so the hanging cases finish quickly.
const TIMEOUT_MS = 40;

interface Options {
  enabled?: boolean;
  budget?: number;
  usedToday?: number;
  failSettings?: boolean;
  failRecord?: boolean;
}

/** The gateway over a scripted model, fixed settings and an in-memory usage log. */
function setup(options: Options = {}) {
  const { enabled = true, budget = 10, usedToday = 0 } = options;
  const ai = new FakeAiService();
  const rows: AiUsageEntry[] = [];
  const settings = {
    aiEnabled: () =>
      options.failSettings
        ? Promise.reject(new Error('database is down'))
        : Promise.resolve(enabled),
    aiDailyBudget: () => Promise.resolve(budget),
  };
  const usage = {
    record: (entry: AiUsageEntry) => {
      if (options.failRecord) {
        return Promise.reject(new Error('insert failed'));
      }
      rows.push(entry);
      return Promise.resolve();
    },
    countToday: () => Promise.resolve(usedToday),
  };
  const gateway = new AiGatewayService(
    ai as unknown as AiService,
    settings as unknown as AdminSettingsService,
    usage as unknown as AiUsageService,
    { aiTimeoutMs: TIMEOUT_MS } as GameConfigService,
  );
  return { ai, rows, gateway };
}

interface Line {
  text: string;
}

const NAP: Line = { text: 'Zzz... napping, try again later.' };
const HELLO = '{"text":"Hello, gardener!"}';
const LONELY = '{"text":"I was so lonely without you."}';

/** A request for one short creature line as JSON. */
function lineRequest(overrides: Partial<AiRequest<Line>> = {}) {
  return {
    feature: 'probe',
    planetId: 'planet-1',
    messages: [{ role: 'user' as const, content: 'Say hello as JSON.' }],
    parse: (text: string) => {
      const json = extractJson(text) as Partial<Line> | null;
      return typeof json?.text === 'string' ? { text: json.text } : null;
    },
    texts: (line: Line) => [line.text],
    limits: { maxWords: 10 },
    fallback: () => NAP,
    ...overrides,
  };
}

function usageRow(overrides: Partial<AiUsageEntry>): AiUsageEntry {
  return {
    feature: 'probe',
    planetId: 'planet-1',
    usedFallback: true,
    reason: null,
    latencyMs: expect.any(Number) as number,
    ...overrides,
  };
}

describe('AiGatewayService', () => {
  it('returns the checked value of a good reply and logs it as answered', async () => {
    const { ai, rows, gateway } = setup();
    ai.respondWith('Sure!\n```json\n' + HELLO + '\n```');

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({
      value: { text: 'Hello, gardener!' },
      source: 'ai',
    });
    expect(ai.calls).toEqual([lineRequest().messages]);
    expect(rows).toEqual([usageRow({ usedFallback: false })]);
  });

  it('uses the fallback without calling the model when the AI is switched off (AIB-05 AC1)', async () => {
    const { ai, rows, gateway } = setup({ enabled: false });

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'disabled',
    });
    expect(ai.calls).toHaveLength(0);
    expect(rows).toEqual([usageRow({ reason: 'disabled' })]);
  });

  it('uses the fallback once the daily budget is used up (ADM-02 AC2)', async () => {
    const { ai, rows, gateway } = setup({ budget: 5, usedToday: 5 });

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'budget',
    });
    expect(ai.calls).toHaveLength(0);
    expect(rows).toEqual([usageRow({ reason: 'budget' })]);
  });

  it('still asks the model with one request of the budget left', async () => {
    const { ai, gateway } = setup({ budget: 5, usedToday: 4 });
    ai.respondWith(HELLO);

    const result = await gateway.generate(lineRequest());

    expect(result.source).toBe('ai');
  });

  it('retries once after a reply of the wrong form and returns the second (AIB-01 AC2)', async () => {
    const { ai, rows, gateway } = setup();
    ai.respondWith('Hello there, no JSON here.', HELLO);

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({
      value: { text: 'Hello, gardener!' },
      source: 'ai',
    });
    expect(ai.calls).toHaveLength(2);
    const retry = ai.calls[1];
    expect(retry.slice(0, -1)).toEqual(lineRequest().messages);
    expect(retry[retry.length - 1]).toEqual({
      role: 'user',
      content: expect.stringContaining(
        'it was not in the requested format',
      ) as string,
    });
    expect(rows).toEqual([usageRow({ usedFallback: false })]);
  });

  it('uses the fallback when both replies are unusable', async () => {
    const { ai, rows, gateway } = setup();
    ai.respondWith('nope', '{"words":"still wrong"}');

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'invalid',
    });
    expect(ai.calls).toHaveLength(2);
    expect(rows).toEqual([usageRow({ reason: 'invalid' })]);
  });

  it('counts a reply that breaks the content rules as unusable and names the rule', async () => {
    const { ai, gateway } = setup();
    ai.respondWith(LONELY, HELLO);

    const result = await gateway.generate(lineRequest());

    expect(result.value).toEqual({ text: 'Hello, gardener!' });
    expect(ai.calls[1][ai.calls[1].length - 1].content).toContain('guilt trip');
  });

  it('falls back when both replies guilt-trip the player', async () => {
    const { ai, gateway } = setup();
    ai.respondWith(LONELY, LONELY);

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'invalid',
    });
  });

  it('checks the length limits and names them in the retry', async () => {
    const { ai, gateway } = setup();
    ai.respondWith(
      '{"text":"one two three four five six seven eight nine ten eleven"}',
      HELLO,
    );

    await gateway.generate(lineRequest());

    expect(ai.calls[1][ai.calls[1].length - 1].content).toContain(
      'it was longer than 10 words',
    );
  });

  it('names the problems the request validates itself', async () => {
    const { ai, gateway } = setup();
    ai.respondWith('{"text":"Hi"}', HELLO);

    const result = await gateway.generate(
      lineRequest({
        validate: (line) =>
          line.text.includes('gardener') ? [] : ['it must greet the gardener'],
      }),
    );

    expect(result.value).toEqual({ text: 'Hello, gardener!' });
    expect(ai.calls[1][ai.calls[1].length - 1].content).toContain(
      'it must greet the gardener',
    );
  });

  it('treats a parse that throws as a reply of the wrong form', async () => {
    const { ai, gateway } = setup();
    ai.respondWith('{', '{');

    const result = await gateway.generate(
      lineRequest({ parse: (text) => JSON.parse(text) as Line }),
    );

    expect(result.reason).toBe('invalid');
    expect(ai.calls).toHaveLength(2);
  });

  it('uses the fallback when the model takes longer than the timeout, without a retry (AIB-04 AC2)', async () => {
    const { ai, rows, gateway } = setup();
    ai.respondWith('hang', HELLO);

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'timeout',
    });
    expect(ai.calls).toHaveLength(1);
    expect(rows).toEqual([usageRow({ reason: 'timeout' })]);
    expect(rows[0].latencyMs).toBeGreaterThanOrEqual(TIMEOUT_MS - 1);
  });

  it('gives the retry only what is left of the one timeout', async () => {
    const { ai, gateway } = setup();
    ai.respondWith('nope', 'hang');

    const result = await gateway.generate(lineRequest());

    expect(result.reason).toBe('timeout');
    expect(ai.calls).toHaveLength(2);
  });

  it('uses the fallback when the model fails, without a retry', async () => {
    const { ai, rows, gateway } = setup();
    ai.respondWith(new Error('AI provider returned 500.'), HELLO);

    const result = await gateway.generate(lineRequest());

    expect(result).toEqual({ value: NAP, source: 'fallback', reason: 'error' });
    expect(ai.calls).toHaveLength(1);
    expect(rows).toEqual([usageRow({ reason: 'error' })]);
  });

  it('uses the fallback when the settings cannot be read', async () => {
    const { ai, gateway } = setup({ failSettings: true });

    const result = await gateway.generate(lineRequest());

    expect(result.reason).toBe('error');
    expect(ai.calls).toHaveLength(0);
  });

  it('awaits an async fallback and logs a call without a planet', async () => {
    const { rows, gateway } = setup({ enabled: false });

    const result = await gateway.generate(
      lineRequest({
        planetId: undefined,
        fallback: () => Promise.resolve(NAP),
      }),
    );

    expect(result.value).toBe(NAP);
    expect(rows).toEqual([usageRow({ planetId: null, reason: 'disabled' })]);
  });

  it('still returns the value when the usage row cannot be written', async () => {
    const { ai, gateway } = setup({ failRecord: true });
    ai.respondWith(HELLO);

    await expect(gateway.generate(lineRequest())).resolves.toEqual({
      value: { text: 'Hello, gardener!' },
      source: 'ai',
    });
  });

  it('lets a throwing fallback through, as a programming error', async () => {
    const { gateway } = setup({ enabled: false });

    await expect(
      gateway.generate(
        lineRequest({
          fallback: () => {
            throw new Error('no fallback written');
          },
        }),
      ),
    ).rejects.toThrow('no fallback written');
  });
});

describe('extractJson', () => {
  it('reads plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson(' [1, 2] ')).toEqual([1, 2]);
  });

  it('reads JSON inside a code fence or prose', () => {
    expect(extractJson('```json\n{"a":[1,{"b":2}]}\n```')).toEqual({
      a: [1, { b: 2 }],
    });
    expect(extractJson('Here you go: {"name":"Bo"} Enjoy!')).toEqual({
      name: 'Bo',
    });
  });

  it('skips brackets in prose that are not JSON', () => {
    expect(extractJson('A word [sic] then {"ok":true}')).toEqual({ ok: true });
  });

  it('is not fooled by brackets and quotes inside strings', () => {
    expect(extractJson('{"text":"a } and a \\" and a {"}')).toEqual({
      text: 'a } and a " and a {',
    });
  });

  it('is null without a JSON object or array', () => {
    expect(extractJson('Just words.')).toBeNull();
    expect(extractJson('{"unfinished": true')).toBeNull();
    expect(extractJson('')).toBeNull();
  });
});
