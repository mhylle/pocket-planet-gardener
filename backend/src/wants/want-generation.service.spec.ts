import { Logger } from '@nestjs/common';
import { FakeAiService } from '../../test/support/fake-ai';
import { SeededRandom } from '../../test/support/seeded-random';
import type { AdminSettingsService } from '../admin/admin-settings.service';
import type { AiUsageEntry, AiUsageService } from '../admin/ai-usage.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import type { AiService } from '../ai/ai.service';
import { checkText } from '../ai/content-rules';
import type { SpeciesId } from '../content/content.types';
import { FALLBACK_WANTS, fillWantTemplate } from '../content/fallback-wants';
import type { CreatureIdentity } from '../creatures/identity.types';
import type { GameConfigService } from '../game-config/game-config.service';
import {
  WantGenerationService,
  type GeneratedWant,
  type WantRequest,
} from './want-generation.service';
import type { WantSpec, WantWorld } from './want-evaluator';
import { buildWantPrompt, WANT_TEXT_LIMITS, wantProblems } from './want-prompt';

// The rejected replies log on purpose; keep that out of the test output.
beforeAll(() => {
  Logger.overrideLogger(false);
});

/** The service over the real gateway, a scripted model and an in-memory usage log. */
function setup({ enabled = true, seed = 7 } = {}) {
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
    service: new WantGenerationService(gateway, new SeededRandom(seed)),
  };
}

const identity: CreatureIdentity = {
  name: 'Mira',
  traits: ['dramatic', 'refined'],
  quirk: 'She calls every lamp a moon.',
  speakingStyle: 'grand, speaks of herself as one',
  backstory:
    'Mira arrived at dusk. She has stared at the lamp-post ever since.',
  summary: 'A grand moth who calls every lamp a moon.',
};

// One blooming clover at home, the lamp-post 4 steps away.
const world: WantWorld = {
  plants: [{ type: 'clover', stage: 'bloom', lat: 0, lon: 0 }],
  decorations: [{ type: 'lamp-post', lat: 0, lon: 20 }],
};

function request(overrides: Partial<WantRequest> = {}): WantRequest {
  return {
    planetId: 'planet-1',
    creature: {
      id: 'creature-1',
      species: 'moth',
      name: 'Mira',
      identity,
      home: { lat: 0, lon: 0 },
    },
    memories: ['Mira was given a lamp-post.'],
    planet: {
      name: 'Moss Moon',
      plants: [{ type: 'clover', stage: 'bloom' }],
      decorations: [{ type: 'lamp-post' }],
      creatures: [{ name: 'Mira', species: 'moth', summary: identity.summary }],
    },
    world,
    unlocked: new Set([
      'clover',
      'sunflower',
      'moonflower',
      'lamp-post',
      'pond',
      'bench',
    ]),
    maxPlants: 60,
    plantCount: 1,
    ...overrides,
  };
}

/** The checks a want must pass for the request, beyond the content rules. */
function problemsFor(want: GeneratedWant, req: WantRequest): string[] {
  return wantProblems(want.spec, { ...req, home: req.creature.home });
}

/** Whether the text is one of the species' pool lines filled with the want. */
function fromPool(species: SpeciesId, want: GeneratedWant): boolean {
  return FALLBACK_WANTS[species][want.spec.type]
    .map((line) => fillWantTemplate(line, want.spec))
    .includes(want.text);
}

const moonflowersNearLamp: WantSpec = {
  type: 'plant-near',
  plant: 'moonflower',
  count: 2,
  near: { kind: 'decoration', decoration: 'lamp-post' },
  withinSteps: 3,
};
const voiced = 'One requires moonflowers. Near the lamp-post, obviously.';

function reply(spec: WantSpec, text = voiced): string {
  return JSON.stringify({ spec, text });
}

/** The last message of the second call: the gateway's retry note. */
function retryNote(ai: FakeAiService): string {
  const retry = ai.calls[1];
  return retry[retry.length - 1].content;
}

describe('WantGenerationService', () => {
  it('returns a valid AI want with source ai and its plain description (WNT-02 AC2)', async () => {
    const { ai, rows, service } = setup();
    ai.respondWith('```json\n' + reply(moonflowersNearLamp) + '\n```');

    const want = await service.generate(request());

    expect(want).toEqual({
      spec: moonflowersNearLamp,
      text: voiced,
      plainDescription: '2 moonflowers within 3 steps of the lamp-post',
      source: 'ai',
    });
    expect(ai.calls).toEqual([buildWantPrompt(request())]);
    expect(rows).toEqual([
      expect.objectContaining({
        feature: 'want',
        planetId: 'planet-1',
        usedFallback: false,
      }),
    ]);
  });

  it('names the creature in a home want description', async () => {
    const { ai, service } = setup();
    ai.respondWith(
      reply(
        { type: 'variety', distinct: 3, withinSteps: 2 },
        'Variety, please.',
      ),
    );

    const want = await service.generate(request());

    expect(want.plainDescription).toBe(
      "3 different plants within 2 steps of Mira's home",
    );
  });

  it('discards an AI want for a locked plant and never returns it (WNT-02 AC4)', async () => {
    const { ai, rows, service } = setup();
    const locked = reply({ type: 'count-blooming', plant: 'cactus', count: 2 });
    ai.respondWith(locked, locked);

    const want = await service.generate(request());

    expect(ai.calls).toHaveLength(2);
    expect(retryNote(ai)).toContain('it may only name the listed ids');
    expect(want.source).toBe('fallback');
    expect(JSON.stringify(want.spec)).not.toContain('cactus');
    expect(problemsFor(want, request())).toEqual([]);
    expect(rows[0]).toEqual(
      expect.objectContaining({ usedFallback: true, reason: 'invalid' }),
    );
  });

  it('takes the retry when it fixes the want', async () => {
    const { ai, service } = setup();
    ai.respondWith(
      reply({ type: 'count-blooming', plant: 'cactus', count: 2 }),
      reply(moonflowersNearLamp),
    );

    const want = await service.generate(request());

    expect(want.source).toBe('ai');
    expect(want.spec).toEqual(moonflowersNearLamp);
  });

  it('retries a want the planet already meets, or text of more than 2 sentences (WNT-01 AC3)', async () => {
    const { ai, service } = setup();
    ai.respondWith(
      reply({ type: 'place-decoration', decoration: 'lamp-post' }),
      reply(moonflowersNearLamp, 'One. Two. Three.'),
    );

    const want = await service.generate(request());

    expect(retryNote(ai)).toContain('the planet already has that');
    expect(want.source).toBe('fallback');
  });

  it('rejects a reply in the wrong form', async () => {
    const { ai, service } = setup();
    ai.respondWith('Moonflowers, please!', reply(moonflowersNearLamp));

    const want = await service.generate(request());

    expect(retryNote(ai)).toContain('not in the requested format');
    expect(want.source).toBe('ai');
  });

  it('falls back to a want from the pool for the species when the AI is down (WNT-02 AC5)', async () => {
    const { ai, rows, service } = setup();
    ai.respondWith(new Error('AI provider returned 500.'));
    const frog = request({
      creature: { ...request().creature, species: 'frog', name: 'Pip' },
    });

    const want = await service.generate(frog);

    expect(want.source).toBe('fallback');
    expect(fromPool('frog', want)).toBe(true);
    expect(problemsFor(want, frog)).toEqual([]);
    expect(want.plainDescription.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual(
      expect.objectContaining({ usedFallback: true, reason: 'error' }),
    );
  });

  it('gives only valid, varied pool wants in the voice of each species', async () => {
    const { ai, service } = setup({ enabled: false });
    const types = new Set<string>();

    for (const species of [
      'worm',
      'snail',
      'bee',
      'moth',
      'hedgehog',
      'frog',
    ] as const) {
      const req = request({ creature: { ...request().creature, species } });
      for (let i = 0; i < 8; i++) {
        const want = await service.generate(req);
        expect(want.source).toBe('fallback');
        expect(fromPool(species, want)).toBe(true);
        expect({ want, problems: problemsFor(want, req) }).toEqual({
          want,
          problems: [],
        });
        expect(checkText(want.text, WANT_TEXT_LIMITS)).toEqual([]);
        types.add(want.spec.type);
      }
    }

    expect(ai.calls).toHaveLength(0);
    expect([...types].sort()).toEqual([
      'count-blooming',
      'place-decoration',
      'plant-near',
      'variety',
    ]);
  });

  describe('in the tutorial (ONB-02 AC3)', () => {
    const owned = new Map([
      ['clover', 3],
      ['sunflower', 2],
    ]);
    const tutorial = () =>
      request({
        creature: { ...request().creature, species: 'worm', name: 'Wiggle' },
        tutorial: true,
        owned,
      });

    /** Whether the seeds and decorations held now are enough to meet the want. */
    function meetsWithOwned(spec: WantSpec): boolean {
      const holds = (item: string) => owned.get(item) ?? 0;
      switch (spec.type) {
        case 'count-blooming':
          return spec.count <= holds(spec.plant);
        case 'plant-near':
          return (
            spec.count <= holds(spec.plant) &&
            (spec.near.kind === 'home' ||
              world.decorations.some(
                (d) =>
                  spec.near.kind === 'decoration' &&
                  d.type === spec.near.decoration,
              ))
          );
        case 'place-decoration':
        case 'bring-back':
          return false;
        case 'variety':
          return spec.distinct <= owned.size;
      }
    }

    it('takes an AI want the held seeds can meet', async () => {
      const { ai, service } = setup();
      const spec: WantSpec = {
        type: 'count-blooming',
        plant: 'clover',
        count: 3,
      };
      ai.respondWith(reply(spec, 'Three clovers in bloom, please.'));

      const want = await service.generate(tutorial());

      expect(want).toEqual(expect.objectContaining({ spec, source: 'ai' }));
    });

    it('discards an AI want that needs more than the player holds', async () => {
      const { ai, service } = setup();
      const tooMany = reply({
        type: 'count-blooming',
        plant: 'clover',
        count: 5,
      });
      const unheld = reply({ type: 'place-decoration', decoration: 'bench' });
      ai.respondWith(tooMany, unheld);

      const want = await service.generate(tutorial());

      expect(retryNote(ai)).toContain(
        'it must be possible with only the items the player holds now',
      );
      expect(want.source).toBe('fallback');
      expect(meetsWithOwned(want.spec)).toBe(true);
    });

    it('only ever falls back to wants the current inventory can meet', async () => {
      const { service } = setup({ enabled: false });

      for (let i = 0; i < 20; i++) {
        const want = await service.generate(tutorial());
        expect({ spec: want.spec, ok: meetsWithOwned(want.spec) }).toEqual({
          spec: want.spec,
          ok: true,
        });
        expect(problemsFor(want, tutorial())).toEqual([]);
      }
    });

    it('still gives a want when the player holds nothing', async () => {
      const { service } = setup({ enabled: false });

      const want = await service.generate(
        request({
          tutorial: true,
          owned: new Map(),
          unlocked: new Set(['clover']),
        }),
      );

      expect(want.spec).toEqual({
        type: 'count-blooming',
        plant: 'clover',
        count: 1,
      });
      expect(want.plainDescription).toBe('1 clover in bloom');
      expect(fromPool('moth', want)).toBe(true);
    });
  });

  describe('for a wistful creature (CRT-04 AC3)', () => {
    const wistful = () =>
      request({
        creature: { ...request().creature, species: 'snail', name: 'Bo' },
        bringBack: { itemKind: 'decoration', item: 'pond' },
      });
    const pondBack: WantSpec = {
      type: 'bring-back',
      itemKind: 'decoration',
      item: 'pond',
    };

    it('takes an AI bring-back of exactly that item', async () => {
      const { ai, service } = setup();
      ai.respondWith(
        reply(pondBack, 'I do miss the pond. Could it come back?'),
      );

      const want = await service.generate(wistful());

      expect(want).toEqual({
        spec: pondBack,
        text: 'I do miss the pond. Could it come back?',
        plainDescription: 'Bring back the pond',
        source: 'ai',
      });
    });

    it('discards any other AI want and falls back to the bring-back', async () => {
      const { ai, service } = setup();
      ai.respondWith(
        reply(moonflowersNearLamp),
        reply({ type: 'bring-back', itemKind: 'decoration', item: 'bench' }),
      );

      const want = await service.generate(wistful());

      expect(retryNote(ai)).toContain('asking for the pond back');
      expect(want.spec).toEqual(pondBack);
      expect(want.source).toBe('fallback');
      expect(fromPool('snail', want)).toBe(true);
    });

    it('gives the bring-back when the AI is off, even for an item not unlocked', async () => {
      const { service } = setup({ enabled: false });

      const want = await service.generate({
        ...wistful(),
        unlocked: new Set(['clover']),
      });

      expect(want.spec).toEqual(pondBack);
      expect(fromPool('snail', want)).toBe(true);
    });
  });
});
