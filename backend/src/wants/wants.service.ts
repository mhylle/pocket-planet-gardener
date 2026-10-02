import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { MoreThan, type EntityManager } from 'typeorm';
import { toPlanetPublicState } from '../ai/prompt-context';
import { RandomService } from '../common/random.service';
import type { ArrivalCondition, SpeciesId } from '../content/content.types';
import { SPECIES } from '../content/species';
import { THANK_YOU_LINES } from '../content/thank-you-lines';
import { gardenView, type GardenView } from '../creatures/arrival-conditions';
import { CreatureMemory } from '../creatures/creature-memory.entity';
import { Creature } from '../creatures/creature.entity';
import { toCreatureDto } from '../creatures/creatures.service';
import { GameConfigService } from '../game-config/game-config.service';
import { Decoration } from '../garden/decoration.entity';
import { Plant } from '../garden/plant.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { Unlock } from '../inventory/unlock.entity';
import type {
  PlanetSnapshotDto,
  WantDto,
} from '../planets/dto/planet-snapshot.dto';
import type {
  MutationContext,
  MutationResult,
} from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import {
  giftDueAt,
  isWantDue,
  isWistful,
  missingItem,
  raiseMood,
} from './mood-rules';
import { RewardService } from './reward.service';
import { evaluate, type WantWorld } from './want-evaluator';
import { WantGenerationService } from './want-generation.service';
import { Want } from './want.entity';

const CONDITIONS = Object.fromEntries(
  SPECIES.map((species) => [species.id, species.arrivalCondition]),
) as Record<SpeciesId, ArrivalCondition>;

/** How many of its latest memories a creature's next want is written with. */
const MEMORIES_PER_WANT = 5;

const NOT_WAITING = 'That wish is not waiting any more.';

/** The planet as one evaluation of the wants sees it. */
interface Scene {
  creatures: Creature[];
  plants: Plant[];
  decorations: Decoration[];
  wants: Want[];
  world: WantWorld;
  garden: GardenView;
}

/**
 * The creatures' wants, moods and gifts (WNT-01..05, CRT-04). After every
 * command and sync it marks met wants fulfilled, with a thank-you, a mood
 * lift, a memory and a reward; updates which creatures are wistful; and
 * gives the next creature that is due a new want. Its simulation step hands
 * out the gifts of creatures overjoyed long enough, and its snapshot
 * contributor puts each creature's active want on it.
 */
@Injectable()
export class WantsService implements OnModuleInit {
  constructor(
    private readonly planetState: PlanetStateService,
    private readonly generation: WantGenerationService,
    private readonly rewards: RewardService,
    private readonly config: GameConfigService,
    private readonly random: RandomService,
  ) {}

  // WantsModule imports CreaturesModule, so Nest runs CreaturesService's
  // onModuleInit first: this evaluator sees the creature that just arrived,
  // and this contributor finds the snapshot's creatures already there.
  onModuleInit(): void {
    this.planetState.registerSimulationStep((ctx) => this.giveGifts(ctx));
    this.planetState.registerPostMutationEvaluator((ctx) =>
      this.checkWants(ctx),
    );
    this.planetState.registerSnapshotContributor(({ em, planet, snapshot }) =>
      this.withWants(em, planet.id, snapshot),
    );
  }

  /**
   * "Maybe later" (WNT-05): the want is put off without a word about mood
   * (AC2), and the creature's cooldown starts again (AC1). A want that is
   * not this planet's or no longer active is a friendly 400.
   */
  maybeLater(
    planetId: string,
    wantId: string,
    expectedVersion: number,
  ): Promise<MutationResult> {
    return this.planetState.mutate(
      planetId,
      expectedVersion,
      async ({ em, now }) => {
        const want = await em.findOneBy(Want, {
          id: wantId,
          planetId,
          status: 'active',
        });
        if (!want) {
          throw new BadRequestException({
            statusCode: 400,
            message: NOT_WAITING,
            reason: 'not-waiting',
          });
        }
        await em.update(
          Want,
          { id: want.id },
          { status: 'dismissed', resolvedAt: now },
        );
      },
    );
  }

  /**
   * The gift step: a creature overjoyed for overjoyedGiftHours gives one
   * item and goes back to cheerful (CRT-04 AC2). Dated when it was due, so
   * a gift during away time is news on return.
   */
  async giveGifts(ctx: MutationContext): Promise<void> {
    const { em, planet, now } = ctx;
    const overjoyed = await em.find(Creature, {
      where: { planetId: planet.id, mood: 'overjoyed' },
      order: { arrivedAt: 'ASC', id: 'ASC' },
    });
    for (const creature of overjoyed) {
      const dueAt = giftDueAt(
        creature.moodSince,
        this.config.overjoyedGiftHours,
      );
      if (dueAt > now) {
        continue;
      }
      const item = await this.rewards.giftFor(ctx);
      await em.update(
        Creature,
        { id: creature.id },
        { mood: 'cheerful', moodSince: dueAt },
      );
      ctx.facts.push({
        type: 'gift-received',
        occurredAt: dueAt,
        payload: { ...about(creature), item },
      });
    }
  }

  /**
   * The evaluator. Wants never expire (WNT-05 AC3): only fulfilment and
   * "Maybe later" end one. At most one new want per mutation, and none in a
   * mutation that brought a creature, so a command or sync waits for the
   * model once at most; the rest follow at later syncs.
   */
  async checkWants(ctx: MutationContext): Promise<void> {
    const scene = await this.loadScene(ctx.em, ctx.planet.id);
    if (scene.creatures.length === 0) {
      return;
    }
    for (const creature of scene.creatures) {
      const want = scene.wants.find(
        (each) => each.creatureId === creature.id && each.status === 'active',
      );
      if (want && evaluate(want.spec, scene.world, creature)) {
        await this.fulfil(ctx, want, creature);
      }
    }
    for (const creature of scene.creatures) {
      const wistful = isWistful(CONDITIONS[creature.species], scene.garden);
      if (wistful !== creature.wistful) {
        creature.wistful = wistful;
        await ctx.em.update(Creature, { id: creature.id }, { wistful });
      }
    }

    if (ctx.facts.some((fact) => fact.type === 'creature-arrived')) {
      return;
    }
    const due = scene.creatures.find((creature) =>
      isWantDue(
        scene.wants.filter((want) => want.creatureId === creature.id),
        ctx.now,
        this.config.wantCooldownMinutes,
      ),
    );
    if (due) {
      await this.giveWant(ctx, due, scene);
    }
  }

  /**
   * Marks the want fulfilled (WNT-02 AC3) and lets the creature react: a
   * thank-you line, its mood one level up (WNT-03 AC1), a memory (AC2) and a
   * reward (WNT-04), all in one want-fulfilled event.
   */
  private async fulfil(
    ctx: MutationContext,
    want: Want,
    creature: Creature,
  ): Promise<void> {
    const { em, now } = ctx;
    want.status = 'fulfilled';
    want.resolvedAt = now;
    await em.update(
      Want,
      { id: want.id },
      { status: 'fulfilled', resolvedAt: now },
    );
    const mood = raiseMood(creature.mood);
    // Overjoyed stays overjoyed from when it got there (CRT-04 AC2).
    if (mood !== creature.mood) {
      creature.mood = mood;
      creature.moodSince = now;
      await em.update(Creature, { id: creature.id }, { mood, moodSince: now });
    }
    await em.insert(CreatureMemory, {
      creatureId: creature.id,
      kind: 'want',
      text: `The gardener granted my wish: ${want.plainDescription}`,
      createdAt: now,
    });
    const reward = await this.rewards.rewardFor(ctx);
    ctx.facts.push({
      type: 'want-fulfilled',
      occurredAt: now,
      payload: {
        ...about(creature),
        wantText: want.text,
        thankYou: this.random.pick(THANK_YOU_LINES[creature.species]),
        reward,
      },
    });
  }

  /**
   * Asks WantGenerationService for the creature's next want and stores it.
   * The planet's very first want is the tutorial one, which the items held
   * now can meet (ONB-02 AC3); a wistful creature asks for what it misses
   * (CRT-04 AC3).
   */
  private async giveWant(
    ctx: MutationContext,
    creature: Creature,
    scene: Scene,
  ): Promise<void> {
    const { em, planet, now } = ctx;
    const memories = await em.find(CreatureMemory, {
      where: { creatureId: creature.id },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: MEMORIES_PER_WANT,
    });
    const held = await em.find(InventoryItem, {
      where: { planetId: planet.id, count: MoreThan(0) },
    });
    const unlocks = await em.find(Unlock, { where: { planetId: planet.id } });
    const bringBack = creature.wistful
      ? missingItem(
          CONDITIONS[creature.species],
          scene.garden,
          new Set(scene.plants.map((plant) => plant.type)),
        )
      : undefined;

    const generated = await this.generation.generate({
      planetId: planet.id,
      creature: {
        id: creature.id,
        species: creature.species,
        name: creature.name,
        identity: { ...creature.identity, name: creature.name },
        home: { lat: creature.lat, lon: creature.lon },
      },
      // Oldest first, as they happened.
      memories: memories.reverse().map((memory) => memory.text),
      planet: toPlanetPublicState({
        name: planet.name,
        plants: scene.plants,
        decorations: scene.decorations,
        creatures: scene.creatures.map(toCreatureDto),
      }),
      world: scene.world,
      unlocked: new Set(unlocks.map((unlock) => unlock.itemType)),
      maxPlants: planet.maxPlants,
      plantCount: scene.plants.length,
      tutorial: scene.wants.length === 0,
      owned: new Map(held.map((stack) => [stack.itemType, stack.count])),
      bringBack,
    });
    await em.insert(Want, {
      creatureId: creature.id,
      planetId: planet.id,
      spec: generated.spec,
      text: generated.text,
      plainDescription: generated.plainDescription,
      status: 'active',
      source: generated.source,
      createdAt: now,
      resolvedAt: null,
    });
  }

  /** The snapshot contributor: each creature with its active want or null. */
  private async withWants(
    em: EntityManager,
    planetId: string,
    snapshot: PlanetSnapshotDto,
  ): Promise<Partial<PlanetSnapshotDto>> {
    if (!snapshot.creatures) {
      return {};
    }
    const active = await em.find(Want, {
      where: { planetId, status: 'active' },
    });
    return {
      creatures: snapshot.creatures.map((creature) => {
        const want = active.find((each) => each.creatureId === creature.id);
        return { ...creature, want: want ? toWantDto(want) : null };
      }),
    };
  }

  // One query after another: they share the transaction's connection.
  private async loadScene(em: EntityManager, planetId: string): Promise<Scene> {
    const creatures = await em.find(Creature, {
      where: { planetId },
      order: { arrivedAt: 'ASC', id: 'ASC' },
    });
    const plants = await em.find(Plant, {
      where: { planetId },
      order: { plantedAt: 'ASC', id: 'ASC' },
    });
    const decorations = await em.find(Decoration, {
      where: { planetId },
      order: { placedAt: 'ASC', id: 'ASC' },
    });
    const wants = await em.find(Want, {
      where: { planetId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return {
      creatures,
      plants,
      decorations,
      wants,
      world: {
        plants: plants.map(({ type, stage, lat, lon }) => ({
          type,
          stage,
          lat,
          lon,
        })),
        decorations: decorations.map(({ type, lat, lon }) => ({
          type,
          lat,
          lon,
        })),
      },
      garden: gardenView(plants, decorations),
    };
  }
}

/** Who an event is about and where its home is, for the event payloads. */
function about(creature: Creature) {
  return {
    creatureId: creature.id,
    name: creature.name,
    species: creature.species,
    lat: creature.lat,
    lon: creature.lon,
  };
}

/** A want as the snapshot serves it, picked by name. */
export function toWantDto(want: Want): WantDto {
  return {
    id: want.id,
    type: want.spec.type,
    text: want.text,
    plainDescription: want.plainDescription,
    spec: want.spec,
  };
}
