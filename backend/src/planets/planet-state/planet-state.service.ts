import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { ClockService } from '../../common/clock.service';
import type { WelcomeBackDto } from '../../events/dto/welcome-back.dto';
import { Decoration } from '../../garden/decoration.entity';
import { Plant } from '../../garden/plant.entity';
import { InventoryItem } from '../../inventory/inventory-item.entity';
import { Unlock } from '../../inventory/unlock.entity';
import type { PlanetSnapshotDto } from '../dto/planet-snapshot.dto';
import { Planet } from '../planet.entity';
import type {
  FactSink,
  MutationCommand,
  MutationContext,
  MutationResult,
  PostMutationEvaluator,
  SimulationStep,
  SnapshotContributor,
  SyncContributor,
} from './mutation.types';
import { toEventDto, toPlanetSnapshot } from './snapshot.mappers';

const DRIFTED_AWAY = 'This planet has drifted away';

/** What sync() returns, and POST /api/planet/sync answers with. */
export type SyncResult = Pick<MutationResult, 'snapshot' | 'events'> & {
  // Added by EventsModule's sync contributor for a returning player (TIM-03).
  welcomeBack?: WelcomeBackDto;
};

/**
 * The planet snapshot and the one mutation backbone (D-2). Other modules
 * plug in by registering hooks, typically from onModuleInit; each list runs
 * in registration order.
 */
@Injectable()
export class PlanetStateService {
  private readonly contributors: SnapshotContributor[] = [];
  private readonly simulationSteps: SimulationStep[] = [];
  private readonly evaluators: PostMutationEvaluator[] = [];
  private readonly factSinks: FactSink[] = [];
  private readonly syncContributors: SyncContributor[] = [];

  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  registerSnapshotContributor(contributor: SnapshotContributor): void {
    this.contributors.push(contributor);
  }

  registerSimulationStep(step: SimulationStep): void {
    this.simulationSteps.push(step);
  }

  registerPostMutationEvaluator(evaluator: PostMutationEvaluator): void {
    this.evaluators.push(evaluator);
  }

  registerFactSink(sink: FactSink): void {
    this.factSinks.push(sink);
  }

  registerSyncContributor(contributor: SyncContributor): void {
    this.syncContributors.push(contributor);
  }

  /** The planet as the client sees it. Pass em to read inside a transaction. */
  async getSnapshot(
    planetId: string,
    em: EntityManager = this.dataSource.manager,
  ): Promise<PlanetSnapshotDto> {
    const planet = await em.findOneBy(Planet, { id: planetId });
    if (!planet) {
      throw new NotFoundException(DRIFTED_AWAY);
    }
    return this.buildSnapshot(em, planet, this.clock.now());
  }

  /**
   * Runs one change to a planet in a single transaction, on the locked row:
   * version check, simulation steps, the command, evaluators, fact sinks.
   * Any throw rolls all of it back. Without a command the version stays;
   * sync() is that case, for the heartbeat.
   */
  mutate(
    planetId: string,
    expectedVersion: number,
    apply?: MutationCommand,
  ): Promise<MutationResult> {
    return this.run(planetId, expectedVersion, { apply });
  }

  /**
   * The heartbeat (D-3): the mutate() pipeline without a command, so the
   * simulation and evaluators catch up. It never bumps the version, so two
   * open tabs do not make each other reload, and it records the visit. The
   * sync contributors add to its answer.
   */
  async sync(planetId: string, expectedVersion: number): Promise<SyncResult> {
    const contributed: object = {};
    const { snapshot, events } = await this.run(planetId, expectedVersion, {
      beforeSave: async (ctx) => {
        for (const contribute of this.syncContributors) {
          Object.assign(
            contributed,
            await contribute(ctx, ctx.planet.lastSeenAt),
          );
        }
        // After the hooks, so they still see when the player was here before.
        ctx.planet.lastSeenAt = ctx.now;
      },
    });
    return { snapshot, events, ...contributed };
  }

  private run(
    planetId: string,
    expectedVersion: number,
    {
      apply,
      beforeSave,
    }: {
      apply?: MutationCommand;
      // Runs after the fact sinks, just before the planet row is saved.
      beforeSave?: (ctx: MutationContext) => Promise<void>;
    },
  ): Promise<MutationResult> {
    return this.dataSource.transaction(async (em) => {
      // FOR NO KEY UPDATE: a concurrent mutation of this planet waits here,
      // then sees the bumped version and gets its 409. Unlike FOR UPDATE it
      // lets other connections insert rows referencing the planet, such as
      // the AI gateway's usage row, so a command may await generate().
      const planet = await em.findOne(Planet, {
        where: { id: planetId },
        lock: { mode: 'for_no_key_update' },
      });
      if (!planet) {
        throw new NotFoundException(DRIFTED_AWAY);
      }
      // Before anything else runs, so a stale client changes nothing (ACC-04 AC2).
      if (planet.version !== expectedVersion) {
        throw new ConflictException('reload');
      }

      const ctx: MutationContext = {
        em,
        planet,
        now: this.clock.now(),
        previousSimulatedAt: planet.lastSimulatedAt,
        facts: [],
        newlyUnlocked: [],
      };
      for (const step of this.simulationSteps) {
        await step(ctx);
      }
      if (apply) {
        await apply(ctx);
      }
      for (const evaluator of this.evaluators) {
        await evaluator(ctx);
      }
      for (const sink of this.factSinks) {
        await sink(ctx, ctx.facts);
      }

      if (apply) {
        planet.version++;
      }
      await beforeSave?.(ctx);
      await em.save(planet);

      return {
        // At ctx.now, the instant the simulation was advanced to.
        snapshot: await this.buildSnapshot(em, planet, ctx.now),
        events: ctx.facts.map(toEventDto),
        newlyUnlocked: ctx.newlyUnlocked,
      };
    });
  }

  // One query after another: inside a transaction they share a connection,
  // which pg does not let run queries side by side.
  private async buildSnapshot(
    em: EntityManager,
    planet: Planet,
    serverTime: Date,
  ): Promise<PlanetSnapshotDto> {
    const planetId = planet.id;
    const plants = await em.find(Plant, {
      where: { planetId },
      order: { plantedAt: 'ASC', id: 'ASC' },
    });
    const decorations = await em.find(Decoration, {
      where: { planetId },
      order: { placedAt: 'ASC', id: 'ASC' },
    });
    // InventoryService deletes emptied stacks; the filter keeps the client to what is held.
    const inventory = await em.find(InventoryItem, {
      where: { planetId, count: MoreThan(0) },
      order: { itemType: 'ASC' },
    });
    const unlocks = await em.find(Unlock, {
      where: { planetId },
      order: { itemType: 'ASC' },
    });

    const snapshot = toPlanetSnapshot(
      planet,
      { plants, decorations, inventory, unlocks },
      serverTime,
    );
    for (const contribute of this.contributors) {
      Object.assign(snapshot, await contribute({ em, planet, snapshot }));
    }
    return snapshot;
  }
}
