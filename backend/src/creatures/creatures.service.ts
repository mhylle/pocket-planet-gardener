import { Injectable, OnModuleInit } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { toPlanetPublicState } from '../ai/prompt-context';
import type {
  ArrivalCondition,
  DecorationId,
  DecorationType,
  SpeciesId,
} from '../content/content.types';
import { DECORATIONS } from '../content/decorations';
import { SPECIES } from '../content/species';
import { GameConfigService } from '../game-config/game-config.service';
import { Decoration } from '../garden/decoration.entity';
import { Plant } from '../garden/plant.entity';
import type { CreatureDto } from '../planets/dto/planet-snapshot.dto';
import type { MutationContext } from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import {
  attractions,
  evaluateArrivals,
  gardenView,
} from './arrival-conditions';
import { Creature } from './creature.entity';
import { chooseHomeSpot } from './home-spot';
import { IdentityService } from './identity.service';

/** A gap since the last simulation longer than this many sync intervals is away time, as in SimulationService. */
const AWAY_AFTER_SYNCS = 3;

const DECORATION_TYPES = Object.fromEntries(
  DECORATIONS.map((decoration) => [decoration.id, decoration]),
) as Record<DecorationId, DecorationType>;

const CONDITIONS = Object.fromEntries(
  SPECIES.map((species) => [species.id, species.arrivalCondition]),
) as Record<SpeciesId, ArrivalCondition>;

/**
 * The planet's creatures (CRT-01, CRT-02, CRT-03, CRT-05). Its evaluator
 * tracks the arrival conditions on every command and sync and moves in the
 * creature that is due, with an identity from IdentityService; its snapshot
 * contributor serves the creatures. Nothing here ever removes a creature.
 */
@Injectable()
export class CreaturesService implements OnModuleInit {
  constructor(
    private readonly planetState: PlanetStateService,
    private readonly identities: IdentityService,
    private readonly config: GameConfigService,
  ) {}

  onModuleInit(): void {
    this.planetState.registerPostMutationEvaluator((ctx) => this.arrive(ctx));
    this.planetState.registerSnapshotContributor(async ({ em, planet }) => ({
      creatures: (await this.creaturesOf(em, planet.id)).map(toCreatureDto),
    }));
  }

  /**
   * The evaluator: updates arrival_tracking and, when a species is due,
   * settles one of its creatures near what drew it and reports a
   * creature-arrived milestone. Runs after the catch-up, so a condition met
   * during away time brings its creature on return (TIM-01 AC2).
   */
  async arrive(ctx: MutationContext): Promise<void> {
    const { em, planet, now } = ctx;
    const planetId = planet.id;
    const plants = await em.find(Plant, {
      where: { planetId },
      order: { plantedAt: 'ASC', id: 'ASC' },
    });
    const decorations = await em.find(Decoration, {
      where: { planetId },
      order: { placedAt: 'ASC', id: 'ASC' },
    });
    const creatures = await this.creaturesOf(em, planetId);
    const gap = now.getTime() - ctx.previousSimulatedAt.getTime();
    const { arrival, tracking } = evaluateArrivals({
      garden: gardenView(plants, decorations),
      creatures,
      tracking: planet.arrivalTracking,
      now,
      away: gap > AWAY_AFTER_SYNCS * this.config.syncIntervalSeconds * 1000,
      cfg: this.config,
    });
    planet.arrivalTracking = tracking;
    if (!arrival) {
      return;
    }

    const { lat, lon } = chooseHomeSpot(
      {
        plants,
        decorations: decorations.map(({ id, type, lat, lon }) => ({
          id,
          lat,
          lon,
          footprintSteps: DECORATION_TYPES[type].footprintSteps,
          isWater: DECORATION_TYPES[type].isWater,
        })),
        maxPlants: planet.maxPlants,
      },
      creatures,
      attractions(CONDITIONS[arrival], plants, decorations),
    );
    const { identity, source } = await this.identities.create({
      species: arrival,
      planetId,
      planet: toPlanetPublicState({
        name: planet.name,
        plants,
        decorations,
        creatures: creatures.map(toCreatureDto),
      }),
      existingNames: creatures.map((creature) => creature.name),
      usedFallbackNames: creatures
        .filter((creature) => creature.identitySource === 'fallback')
        .map((creature) => creature.name),
    });
    // Picked by name, so nothing else the identity carries is stored.
    const { name, traits, quirk, speakingStyle, backstory, summary } = identity;
    const creature = await em.save(
      em.create(Creature, {
        planetId,
        species: arrival,
        name,
        identity: { traits, quirk, speakingStyle, backstory, summary },
        identitySource: source,
        mood: 'content',
        moodSince: now,
        wistful: false,
        lat,
        lon,
        arrivedAt: now,
      }),
    );
    ctx.facts.push({
      type: 'creature-arrived',
      occurredAt: now,
      payload: {
        creatureId: creature.id,
        species: arrival,
        name,
        lat,
        lon,
        milestone: true,
      },
    });
  }

  /** The planet's creatures, oldest arrival first. */
  private creaturesOf(
    em: EntityManager,
    planetId: string,
  ): Promise<Creature[]> {
    return em.find(Creature, {
      where: { planetId },
      order: { arrivedAt: 'ASC', id: 'ASC' },
    });
  }
}

/** A creature as the snapshot serves it, picked by name. */
export function toCreatureDto(creature: Creature): CreatureDto {
  const { summary, traits, quirk, speakingStyle, backstory } =
    creature.identity;
  return {
    id: creature.id,
    species: creature.species,
    name: creature.name,
    summary,
    traits,
    quirk,
    speakingStyle,
    backstory,
    mood: creature.mood,
    wistful: creature.wistful,
    lat: creature.lat,
    lon: creature.lon,
    arrivedAt: creature.arrivedAt.toISOString(),
    identitySource: creature.identitySource,
    // WantsModule's snapshot contributor fills in the active want.
    want: null,
  };
}
