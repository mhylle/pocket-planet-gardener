import type { EntityManager } from 'typeorm';
import type { EventDto, PlanetSnapshotDto } from '../dto/planet-snapshot.dto';
import type { Planet } from '../planet.entity';

/**
 * Something a mutation found or caused, such as a plant blooming during
 * catch-up. The fact sinks get every fact of the mutation, and the client
 * gets them back as events.
 */
export interface Fact {
  type: string;
  // May lie in the past, e.g. a bloom the away-time catch-up found.
  occurredAt: Date;
  payload: Record<string, unknown>;
}

/** What every hook of one mutate() call shares. */
export interface MutationContext {
  // The transaction: read and write through it, never through a repository.
  readonly em: EntityManager;
  // The locked planet row. Change it in place; mutate() saves it.
  readonly planet: Planet;
  // Read from the clock once, so every hook sees the same instant.
  readonly now: Date;
  // planet.lastSimulatedAt before the simulation steps moved it to now, so a
  // later hook can tell live play from away time.
  readonly previousSimulatedAt: Date;
  // Push to these; they are returned to the caller.
  readonly facts: Fact[];
  readonly newlyUnlocked: string[];
}

/** Advances the planet towards ctx.now before the command (D-1). */
export type SimulationStep = (ctx: MutationContext) => void | Promise<void>;

/** The player's command, run after the simulation is up to date. */
export type MutationCommand = (ctx: MutationContext) => void | Promise<void>;

/** Reacts to the new state after the command, e.g. creature arrivals. */
export type PostMutationEvaluator = (
  ctx: MutationContext,
) => void | Promise<void>;

/** Receives all facts of the mutation, e.g. to append them to the event log. */
export type FactSink = (
  ctx: MutationContext,
  facts: readonly Fact[],
) => void | Promise<void>;

/** Adds a module's slice to the snapshot, e.g. its creatures. */
export type SnapshotContributor = (context: {
  em: EntityManager;
  planet: Planet;
  // The snapshot so far, including what earlier contributors added.
  snapshot: PlanetSnapshotDto;
}) => object | Promise<object>;

/**
 * Adds to a sync's answer, e.g. the welcome-back summary. Runs on sync()
 * only, after the fact sinks, so this sync's facts are already stored, and
 * before lastSeenAt moves to now: previousLastSeenAt is the last visit.
 */
export type SyncContributor = (
  ctx: MutationContext,
  previousLastSeenAt: Date,
) => object | Promise<object>;

/** What mutate() returns and a command answers with; a sync answers with SyncResult. */
export interface MutationResult {
  snapshot: PlanetSnapshotDto;
  events: EventDto[];
  newlyUnlocked: string[];
}
