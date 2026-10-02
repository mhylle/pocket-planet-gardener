import { Logger } from '@nestjs/common';
import { FakeAiService } from '../../test/support/fake-ai';
import { SeededRandom } from '../../test/support/seeded-random';
import type { AdminSettingsService } from '../admin/admin-settings.service';
import type { AiUsageEntry, AiUsageService } from '../admin/ai-usage.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import type { AiService } from '../ai/ai.service';
import type { PlanetPublicState } from '../ai/prompt-context';
import { FALLBACK_IDENTITIES } from '../content/fallback-identities';
import type { GameConfigService } from '../game-config/game-config.service';
import { buildIdentityPrompt } from './identity-prompt';
import { IdentityService } from './identity.service';
import type { CreatureIdentity, IdentityRequest } from './identity.types';

// The rejected replies log on purpose; keep that out of the test output.
beforeAll(() => {
  Logger.overrideLogger(false);
});

/** The service over the real gateway, a scripted model and an in-memory usage log. */
function setup({ enabled = true } = {}) {
  const ai = new FakeAiService();
  const rows: AiUsageEntry[] = [];
  const settings = {
    aiEnabled: () => Promise.resolve(enabled),
    aiDailyBudget: () => Promise.resolve(100),
  };
  const usage = {
    record: (entry: AiUsageEntry) => {
      rows.push(entry);
      return Promise.resolve();
    },
    countToday: () => Promise.resolve(0),
  };
  const gateway = new AiGatewayService(
    ai as unknown as AiService,
    settings as unknown as AdminSettingsService,
    usage as unknown as AiUsageService,
    { aiTimeoutMs: 200 } as GameConfigService,
  );
  return {
    ai,
    rows,
    service: new IdentityService(gateway, new SeededRandom(7)),
  };
}

const planet: PlanetPublicState = {
  name: 'Moss Moon',
  plants: [{ type: 'clover', stage: 'bloom' }],
  decorations: [{ type: 'pond' }],
  creatures: [{ name: 'Lumen', species: 'moth', summary: 'Loves lamps.' }],
};

function request(overrides: Partial<IdentityRequest> = {}): IdentityRequest {
  return {
    species: 'snail',
    planetId: 'planet-1',
    planet,
    existingNames: ['Lumen'],
    ...overrides,
  };
}

const identity: CreatureIdentity = {
  name: 'Bellamy',
  traits: ['dramatic', 'proud'],
  quirk: 'He believes he is a famous opera singer.',
  speakingStyle: 'grand and theatrical',
  backstory: 'He sings to the clover. He bows slowly. The bow takes all day.',
  summary: 'A slow snail who believes he is an opera star.',
};

function reply(overrides: Partial<CreatureIdentity> = {}): string {
  return JSON.stringify({ ...identity, ...overrides });
}

const snailNames = FALLBACK_IDENTITIES.snail.map((each) => each.name);

/** The last message of the second call: the gateway's retry note. */
function retryNote(ai: FakeAiService): string {
  const retry = ai.calls[1];
  return retry[retry.length - 1].content;
}

describe('IdentityService', () => {
  it('accepts a valid AI identity with source ai and logs the call', async () => {
    const { ai, rows, service } = setup();
    ai.respondWith('```json\n' + reply() + '\n```');

    const result = await service.create(request());

    expect(result).toEqual({ identity, source: 'ai' });
    expect(ai.calls).toEqual([
      buildIdentityPrompt({
        species: 'snail',
        planet,
        existingNames: ['Lumen'],
      }),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        feature: 'identity',
        planetId: 'planet-1',
        usedFallback: false,
      }),
    ]);
  });

  it('retries a 4-sentence backstory, then falls back (AIB-01 AC2)', async () => {
    const { ai, service } = setup();
    const tooLong = reply({ backstory: 'One. Two. Three. Four.' });
    ai.respondWith(tooLong, tooLong);

    const result = await service.create(request());

    expect(ai.calls).toHaveLength(2);
    expect(retryNote(ai)).toContain('the backstory had more than 3 sentences');
    expect(result.source).toBe('fallback');
    expect(snailNames).toContain(result.identity.name);
  });

  it('takes the retry when it fixes the backstory', async () => {
    const { ai, service } = setup();
    ai.respondWith(reply({ backstory: 'One. Two. Three. Four.' }), reply());

    const result = await service.create(request());

    expect(result).toEqual({ identity, source: 'ai' });
  });

  it('rejects a name already on the planet, ignoring case (CRT-03 AC2)', async () => {
    const { ai, service } = setup();
    ai.respondWith(reply({ name: 'lumen' }), reply());

    const result = await service.create(request());

    expect(retryNote(ai)).toContain('the name "lumen" is already used');
    expect(result.identity.name).toBe('Bellamy');
  });

  it('falls back when both replies reuse a name on the planet', async () => {
    const { ai, service } = setup();
    ai.respondWith(reply({ name: 'Lumen' }), reply({ name: 'LUMEN' }));

    const result = await service.create(request());

    expect(result.source).toBe('fallback');
    expect(result.identity.name).not.toBe('Lumen');
  });

  it('rejects a famous name such as Pikachu', async () => {
    const { ai, service } = setup();
    ai.respondWith(reply({ name: 'Pikachu' }), reply({ name: 'Pikachu' }));

    const result = await service.create(request());

    expect(retryNote(ai)).toContain('not a famous character');
    expect(result.source).toBe('fallback');
  });

  it('rejects text that breaks the content rules', async () => {
    const { ai, service } = setup();
    ai.respondWith(reply({ quirk: 'He was so lonely without you.' }), reply());

    await service.create(request());

    expect(retryNote(ai)).toContain('guilt trip');
  });

  it('gives a complete fallback identity without an error when the model fails (CRT-03 AC4)', async () => {
    const { ai, rows, service } = setup();
    ai.respondWith(new Error('AI provider returned 500.'));

    const result = await service.create(request({ species: 'moth' }));

    expect(result.source).toBe('fallback');
    expect(FALLBACK_IDENTITIES.moth).toContainEqual(result.identity);
    expect(rows[0]).toEqual(
      expect.objectContaining({ usedFallback: true, reason: 'error' }),
    );
  });

  it('gives consecutive fallbacks on one planet different identities', async () => {
    const { ai, service } = setup({ enabled: false });
    const used: string[] = [];

    for (let i = 0; i < snailNames.length; i++) {
      const { identity: next, source } = await service.create(
        request({ usedFallbackNames: [...used] }),
      );
      expect(source).toBe('fallback');
      used.push(next.name);
    }

    expect(ai.calls).toHaveLength(0);
    expect(new Set(used).size).toBe(snailNames.length);
    expect([...used].sort()).toEqual([...snailNames].sort());
  });

  it('never gives a fallback a name on the planet, even once all have been used', async () => {
    const { service } = setup({ enabled: false });
    const [free, ...taken] = snailNames;

    const result = await service.create(
      request({
        existingNames: taken.map((name) => name.toUpperCase()),
        usedFallbackNames: snailNames,
      }),
    );

    expect(result.identity.name).toBe(free);
  });

  it('hands out a copy, so the pool cannot be changed through it', async () => {
    const { service } = setup({ enabled: false });

    const { identity: given } = await service.create(request());
    given.traits.push('changed');

    const original = FALLBACK_IDENTITIES.snail.find(
      (each) => each.name === given.name,
    );
    expect(original?.traits).not.toContain('changed');
  });
});
