import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  And,
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThan,
} from 'typeorm';
import type { Fact } from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import { PlanetEvent } from './event.entity';

const BLOOMED = 'plant-bloomed';

/**
 * The planet's event log. As the fact sink it appends every fact of every
 * mutation in that mutation's transaction, so the log holds exactly what
 * happened; the welcome-back summary and the journal read it (JRN-02).
 */
@Injectable()
export class EventLogService implements OnModuleInit {
  constructor(
    private readonly planetState: PlanetStateService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.planetState.registerFactSink((ctx, facts) =>
      this.append(ctx.em, ctx.planet.id, facts),
    );
  }

  /**
   * Stores the facts as events. The planet's first ever bloom is a
   * milestone, and so is any fact whose payload says milestone: true
   * (JRN-03 AC2).
   */
  async append(
    em: EntityManager,
    planetId: string,
    facts: readonly Fact[],
  ): Promise<void> {
    if (facts.length === 0) {
      return;
    }
    const firstBloom = await this.firstBloomAmong(em, planetId, facts);
    // save, not insert: insert's typing rejects a payload of unknown values.
    await em.save(
      PlanetEvent,
      facts.map((fact) => ({
        planetId,
        type: fact.type,
        payload: fact.payload,
        occurredAt: fact.occurredAt,
        isMilestone: fact === firstBloom || fact.payload.milestone === true,
      })),
    );
  }

  /** The events after from, oldest first. Pass em to read inside a transaction. */
  since(
    planetId: string,
    from: Date,
    em: EntityManager = this.dataSource.manager,
  ): Promise<PlanetEvent[]> {
    return em.find(PlanetEvent, {
      where: { planetId, occurredAt: MoreThan(from) },
      order: { occurredAt: 'ASC', id: 'ASC' },
    });
  }

  /** The milestones after from, up to and including to, oldest first (JRN-03 AC2). */
  milestones(
    planetId: string,
    from: Date,
    to: Date,
    em: EntityManager = this.dataSource.manager,
  ): Promise<PlanetEvent[]> {
    return em.find(PlanetEvent, {
      where: {
        planetId,
        isMilestone: true,
        occurredAt: And(MoreThan(from), LessThanOrEqual(to)),
      },
      order: { occurredAt: 'ASC', id: 'ASC' },
    });
  }

  /** The earliest bloom among the facts, when the planet has never bloomed before. */
  private async firstBloomAmong(
    em: EntityManager,
    planetId: string,
    facts: readonly Fact[],
  ): Promise<Fact | undefined> {
    const blooms = facts.filter((fact) => fact.type === BLOOMED);
    if (
      blooms.length === 0 ||
      (await em.existsBy(PlanetEvent, { planetId, type: BLOOMED }))
    ) {
      return undefined;
    }
    return blooms.reduce((first, bloom) =>
      bloom.occurredAt.getTime() < first.occurredAt.getTime() ? bloom : first,
    );
  }
}
