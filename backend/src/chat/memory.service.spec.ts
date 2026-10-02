import type { Repository } from 'typeorm';
import type { AiGatewayService } from '../ai/ai-gateway.service';
import type { AiRequest, AiResult } from '../ai/ai-gateway.types';
import type { CreatureMemory } from '../creatures/creature-memory.entity';
import { FakeClock } from '../../test/support/fake-clock';
import { MemoryService } from './memory.service';

const NOW = new Date('2030-01-01T09:00:00.000Z');

const IDENTITY = {
  name: 'Wigglenut',
  traits: ['bubbly', 'curious'],
  quirk: 'Believes that every pebble is actually a sleeping mountain.',
  speakingStyle: 'bubbly and breathless',
  backstory: 'It tunnelled up to see the sky.',
  summary: 'A bubbly worm who loves pebbles.',
};

/**
 * MemoryService with an in-memory table and a gateway stand-in that reads
 * the scripted reply with the request's parse, as the real one does, and
 * falls back when it is unusable or null, as when the model is away.
 */
function build(reply: string | null) {
  const stored: Partial<CreatureMemory>[] = [];
  const requests: AiRequest<unknown>[] = [];
  const memories = {
    insert: (row: Partial<CreatureMemory>) => {
      stored.push(row);
      return Promise.resolve();
    },
  };
  const gateway = {
    async generate<T>(req: AiRequest<T>): Promise<AiResult<T>> {
      requests.push(req);
      const value = reply === null ? null : req.parse(reply);
      return value === null
        ? { value: await req.fallback(), source: 'fallback', reason: 'invalid' }
        : { value, source: 'ai' };
    },
  };
  const service = new MemoryService(
    memories as unknown as Repository<CreatureMemory>,
    gateway as unknown as AiGatewayService,
    new FakeClock(NOW),
  );
  return { service, stored, requests };
}

function extract(service: MemoryService) {
  return service.extractHighlight({
    planetId: 'planet-1',
    creatureId: 'creature-1',
    identity: IDENTITY,
    turns: [
      { role: 'user', text: 'I love sunflowers!' },
      { role: 'creature', text: 'Sunflowers are tall pebble-mountains!' },
    ],
  });
}

describe('MemoryService.extractHighlight', () => {
  it('keeps the highlight as a chat memory, asked as the memory feature', async () => {
    const { service, stored, requests } = build(
      'The gardener loves sunflowers.',
    );

    await expect(extract(service)).resolves.toBe(
      'The gardener loves sunflowers.',
    );

    expect(stored).toEqual([
      {
        creatureId: 'creature-1',
        kind: 'chat',
        text: 'The gardener loves sunflowers.',
        createdAt: NOW,
      },
    ]);
    expect(requests[0]).toMatchObject({
      feature: 'memory',
      planetId: 'planet-1',
    });
    expect(JSON.stringify(requests[0].messages)).toContain(
      'I love sunflowers!',
    );
  });

  it('drops quotes around the sentence', async () => {
    const { service, stored } = build('  "The gardener told a cloud joke."\n');

    await extract(service);

    expect(stored[0].text).toBe('The gardener told a cloud joke.');
  });

  it.each(['NONE', 'none.', ' "NONE" '])(
    'keeps nothing when the model answers %p',
    async (reply) => {
      const { service, stored } = build(reply);

      await expect(extract(service)).resolves.toBeNull();

      expect(stored).toEqual([]);
    },
  );

  it('keeps nothing when the gateway falls back', async () => {
    const { service, stored } = build(null);

    await expect(extract(service)).resolves.toBeNull();

    expect(stored).toEqual([]);
  });

  it('refuses an empty reply as having the wrong form', async () => {
    const { service, stored } = build('   ');

    await expect(extract(service)).resolves.toBeNull();

    expect(stored).toEqual([]);
  });
});
