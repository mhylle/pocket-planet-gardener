import type { EntityManager } from 'typeorm';
import type { GameConfigService } from '../game-config/game-config.service';
import type {
  MutationContext,
  SyncContributor,
} from '../planets/planet-state/mutation.types';
import type { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type { SummarisedEvent } from './event-summary';
import type { EventLogService } from './event-log.service';
import { ReturnService } from './return.service';

const PLANET_ID = 'planet-1';
const LAST_SEEN = new Date('2030-01-01T00:00:00.000Z');
const MINUTE_MS = 60_000;

const BLOOM: SummarisedEvent = {
  type: 'plant-bloomed',
  payload: { plantId: 'plant-1', type: 'sunflower', lat: 10, lon: 20 },
};
const STAGE: SummarisedEvent = {
  type: 'plant-stage',
  payload: { plantId: 'plant-1', type: 'sunflower', stage: 'young' },
};

function setup(logged: SummarisedEvent[]) {
  const em = {} as EntityManager;
  const reads: unknown[][] = [];
  const contributors: SyncContributor[] = [];
  const eventLog = {
    since: (...args: unknown[]) => {
      reads.push(args);
      return Promise.resolve(logged);
    },
  };
  const planetState = {
    registerSyncContributor: (contributor: SyncContributor) =>
      contributors.push(contributor),
  };
  const service = new ReturnService(
    planetState as unknown as PlanetStateService,
    eventLog as unknown as EventLogService,
    { summaryAfterMinutes: 60 } as GameConfigService,
  );
  const ctxAfter = (minutes: number) =>
    ({
      em,
      planet: { id: PLANET_ID },
      now: new Date(LAST_SEEN.getTime() + minutes * MINUTE_MS),
    }) as unknown as MutationContext;
  return { em, reads, contributors, service, ctxAfter };
}

describe('ReturnService', () => {
  it('summarises the events since the last visit after an hour away (TIM-03 AC1)', async () => {
    const { em, reads, service, ctxAfter } = setup([STAGE, BLOOM]);

    const result = await service.buildReturn(ctxAfter(180), LAST_SEEN);

    expect(result).toEqual({
      welcomeBack: {
        summary: [
          {
            kind: 'blooms',
            count: 1,
            text: '1 plant bloomed',
            focus: { lat: 10, lon: 20 },
          },
        ],
      },
    });
    expect(reads).toEqual([[PLANET_ID, LAST_SEEN, em]]);
  });

  it('counts exactly summaryAfterMinutes as long enough', async () => {
    const { service, ctxAfter } = setup([BLOOM]);

    const result = await service.buildReturn(ctxAfter(60), LAST_SEEN);

    expect(result.welcomeBack?.summary).toHaveLength(1);
  });

  it('says nothing after less than summaryAfterMinutes, without reading the log (AC2)', async () => {
    const { reads, service, ctxAfter } = setup([BLOOM]);

    const result = await service.buildReturn(ctxAfter(59), LAST_SEEN);

    expect(result).toEqual({});
    expect(reads).toEqual([]);
  });

  it('says nothing when nothing worth saying happened (AC2)', async () => {
    const { service, ctxAfter } = setup([STAGE]);

    expect(await service.buildReturn(ctxAfter(180), LAST_SEEN)).toEqual({});
  });

  describe('with a journal writer (JRN-01)', () => {
    const ENTRY = {
      id: 'entry-1',
      text: 'A quiet day.',
      source: 'template' as const,
      createdAt: '2030-01-01T05:00:00.000Z',
      coversFrom: '2029-12-25T05:00:00.000Z',
      coversTo: '2030-01-01T05:00:00.000Z',
      milestones: [],
    };

    it('adds the journal entry beside the summary, and asks the writer with the last visit', async () => {
      const { em, service, ctxAfter } = setup([BLOOM]);
      const asked: unknown[][] = [];
      service.registerJournalWriter((ctx, previousLastSeenAt) => {
        asked.push([ctx.em, previousLastSeenAt]);
        return Promise.resolve(ENTRY);
      });

      const result = await service.buildReturn(ctxAfter(300), LAST_SEEN);

      expect(result.welcomeBack?.summary).toHaveLength(1);
      expect(result.welcomeBack?.journalEntry).toEqual(ENTRY);
      expect(asked).toEqual([[em, LAST_SEEN]]);
    });

    it('sends a quiet day entry with an empty summary (JRN-02 AC3)', async () => {
      const { service, ctxAfter } = setup([STAGE]);
      service.registerJournalWriter(() => Promise.resolve(ENTRY));

      expect(await service.buildReturn(ctxAfter(300), LAST_SEEN)).toEqual({
        welcomeBack: { summary: [], journalEntry: ENTRY },
      });
    });

    it('leaves journalEntry out when the writer has nothing', async () => {
      const { service, ctxAfter } = setup([BLOOM]);
      service.registerJournalWriter(() => Promise.resolve(undefined));

      const result = await service.buildReturn(ctxAfter(180), LAST_SEEN);

      expect(result.welcomeBack).not.toHaveProperty('journalEntry');
      expect(result.welcomeBack?.summary).toHaveLength(1);
      expect(await service.buildReturn(ctxAfter(30), LAST_SEEN)).toEqual({});
    });
  });

  it('registers buildReturn as a sync contributor', async () => {
    const { contributors, service, ctxAfter } = setup([BLOOM]);
    service.onModuleInit();

    const result = await contributors[0](ctxAfter(180), LAST_SEEN);

    expect(contributors).toHaveLength(1);
    expect(result).toHaveProperty('welcomeBack');
  });
});
