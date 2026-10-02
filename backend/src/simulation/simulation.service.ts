import { Injectable, OnModuleInit } from '@nestjs/common';
import type { PlantId } from '../content/content.types';
import { PLANTS } from '../content/plants';
import { GameConfigService } from '../game-config/game-config.service';
import { Plant } from '../garden/plant.entity';
import type {
  Fact,
  MutationContext,
} from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type { Planet } from '../planets/planet.entity';
import {
  advancePlant,
  type Exposure,
  type GrowthState,
  type PlantNeeds,
  type ReachedStage,
} from './growth-rules';
import { lightAt, sunAngleAt } from './sun-model';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Slices end on multiples of this since the epoch, and the light of a slice
 * is read at the middle of its 15 minutes, so the result does not depend on
 * how often the simulation runs.
 */
const SLICE_MS = 15 * MINUTE_MS;

/** A heartbeat gap longer than this many sync intervals is away time. */
const AWAY_AFTER_SYNCS = 3;

// Plant types come from the content, so every stored type is listed here.
const NEEDS = Object.fromEntries(
  PLANTS.map((plant): [PlantId, PlantNeeds] => [plant.id, plant]),
) as Record<PlantId, PlantNeeds>;

/** One slice of the time being simulated; sunAngle is null while away. */
interface Slice {
  start: number;
  minutes: number;
  sunAngle: number | null;
}

/**
 * Growth over time (D-1). Before every command and sync it grows the planet's
 * plants from lastSimulatedAt to now with the pure growth rules: under the
 * real sun while the player is here, under average light for away time
 * (TIM-01), at most maxAwayDays of it (TIM-02). It also serves where the sun
 * is now.
 */
@Injectable()
export class SimulationService implements OnModuleInit {
  constructor(
    private readonly planetState: PlanetStateService,
    private readonly config: GameConfigService,
  ) {}

  onModuleInit(): void {
    this.planetState.registerSimulationStep((ctx) => this.advance(ctx));
    this.planetState.registerSnapshotContributor(({ planet, snapshot }) => ({
      sun: {
        ...snapshot.sun,
        angle: this.sunAngle(planet, new Date(snapshot.serverTime)),
      },
    }));
  }

  /** The longitude the sun stands over at time t, after any drag (GRD-03). */
  sunAngle(planet: Planet, t: Date): number {
    const { sunOverrideAngle: angle, sunOverrideAt: at } = planet;
    return sunAngleAt(
      t,
      this.config.sunDayMinutes,
      angle !== null && at ? { angle, at } : null,
      this.config.sunOverrideMinutes,
    );
  }

  /**
   * The simulation step: grows every plant up to ctx.now, saves the changed
   * ones, and reports each stage reached as a fact at the moment it happened.
   * A sprout or young plant is a plant-stage fact; reaching bloom is a
   * plant-bloomed fact instead, with the spot to show.
   */
  async advance(ctx: MutationContext): Promise<void> {
    const { em, planet, now } = ctx;
    const from = planet.lastSimulatedAt.getTime();
    const gap = now.getTime() - from;
    // A clock set back must not rewind the planet or grow it twice.
    if (gap <= 0) {
      return;
    }
    const slices = this.slicesFor(planet, from, gap);
    const plants = await em.find(Plant, { where: { planetId: planet.id } });
    const facts: Fact[] = [];
    const changed: Plant[] = [];
    for (const plant of plants) {
      if (this.grow(plant, slices, facts)) {
        changed.push(plant);
      }
    }
    if (changed.length > 0) {
      await em.save(changed);
    }
    // Plant by plant above; the caller gets them in the order they happened.
    facts.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    ctx.facts.push(...facts);
    // Now, not the capped end: time beyond maxAwayDays is simply let go.
    planet.lastSimulatedAt = now;
  }

  /** The slices after lastSimulatedAt, capped at maxAwayDays (TIM-02 AC2). */
  private slicesFor(planet: Planet, from: number, gap: number): Slice[] {
    const to = from + Math.min(gap, this.config.maxAwayDays * DAY_MS);
    const away =
      gap > AWAY_AFTER_SYNCS * this.config.syncIntervalSeconds * 1000;
    const slices: Slice[] = [];
    for (let start = from; start < to;) {
      const sliceStart = Math.floor(start / SLICE_MS) * SLICE_MS;
      const end = Math.min(sliceStart + SLICE_MS, to);
      const middle = new Date(sliceStart + SLICE_MS / 2);
      slices.push({
        start,
        minutes: (end - start) / MINUTE_MS,
        sunAngle: away ? null : this.sunAngle(planet, middle),
      });
      start = end;
    }
    return slices;
  }

  /** Grows one plant through the slices; true when it changed. */
  private grow(plant: Plant, slices: Slice[], facts: Fact[]): boolean {
    const needs = NEEDS[plant.type];
    const { stage, growth, water, harvestReady } = plant;
    let state: GrowthState = { stage, growth, water, harvestReady };
    for (const slice of slices) {
      const exposure: Exposure =
        slice.sunAngle === null ? 'away' : lightAt(plant, slice.sunAngle);
      const result = advancePlant(
        state,
        needs,
        slice.minutes,
        exposure,
        this.config,
      );
      for (const reached of result.reachedStages) {
        facts.push(stageFact(plant, reached, slice.start));
      }
      state = result.state;
    }
    Object.assign(plant, state);
    return (
      plant.stage !== stage ||
      plant.growth !== growth ||
      plant.water !== water ||
      plant.harvestReady !== harvestReady
    );
  }
}

function stageFact(plant: Plant, reached: ReachedStage, start: number): Fact {
  const occurredAt = new Date(Math.round(start + reached.atMinute * MINUTE_MS));
  const { id: plantId, type } = plant;
  return reached.stage === 'bloom'
    ? {
        type: 'plant-bloomed',
        occurredAt,
        payload: { plantId, type, lat: plant.lat, lon: plant.lon },
      }
    : {
        type: 'plant-stage',
        occurredAt,
        payload: { plantId, type, stage: reached.stage },
      };
}
