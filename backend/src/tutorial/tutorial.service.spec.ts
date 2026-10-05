import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { TUTORIAL_STEPS } from '../content/tutorial';
import type { Planet } from '../planets/planet.entity';
import { TutorialService } from './tutorial.service';

const PLANET_ID = 'planet-1';

/** A Planet repository holding one planet at a step, or none. */
function setup(tutorialStep: number | null) {
  const updates: unknown[][] = [];
  const locks: unknown[] = [];
  const em = {
    findOne: (_entity: unknown, options: { lock?: unknown }) => {
      locks.push(options.lock);
      return Promise.resolve(
        tutorialStep === null ? null : { id: PLANET_ID, tutorialStep },
      );
    },
    update: (_entity: unknown, ...args: unknown[]) => {
      updates.push(args);
      return Promise.resolve({ affected: 1 });
    },
  } as unknown as EntityManager;
  const planets = {
    manager: {
      transaction: <T>(work: (em: EntityManager) => Promise<T>) => work(em),
    },
  } as unknown as Repository<Planet>;
  return { service: new TutorialService(planets), updates, locks };
}

describe('TutorialService', () => {
  it("serves Pip's steps in order", () => {
    const { service } = setup(0);

    expect(service.tutorial()).toEqual({ steps: TUTORIAL_STEPS });
  });

  it('keeps a later step on the locked planet row, and only the step', async () => {
    const { service, updates, locks } = setup(0);

    await expect(service.setStep(PLANET_ID, 3)).resolves.toEqual({
      tutorialStep: 3,
    });
    expect(locks).toEqual([{ mode: 'for_no_key_update' }]);
    expect(updates).toEqual([[{ id: PLANET_ID }, { tutorialStep: 3 }]]);
  });

  it('refuses an earlier step with a friendly 400 and keeps nothing', async () => {
    const { service, updates } = setup(3);

    const refusal = service.setStep(PLANET_ID, 2);

    await expect(refusal).rejects.toThrow(BadRequestException);
    await expect(refusal).rejects.toThrow(
      "Pip can't go to that step from here.",
    );
    expect(updates).toEqual([]);
  });

  it('refuses a step past the last one', async () => {
    const { service } = setup(0);

    await expect(
      service.setStep(PLANET_ID, TUTORIAL_STEPS.length),
    ).rejects.toThrow(BadRequestException);
  });

  it('restarts a finished tutorial', async () => {
    const { service, updates } = setup(-1);

    await expect(service.setStep(PLANET_ID, 0)).resolves.toEqual({
      tutorialStep: 0,
    });
    expect(updates).toEqual([[{ id: PLANET_ID }, { tutorialStep: 0 }]]);
  });

  it('answers 404 for a planet that has gone', async () => {
    const { service } = setup(null);

    await expect(service.setStep(PLANET_ID, 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});
