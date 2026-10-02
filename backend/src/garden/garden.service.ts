import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecorationId, DecorationType } from '../content/content.types';
import { DECORATIONS } from '../content/decorations';
import {
  InventoryService,
  type GrantItem,
} from '../inventory/inventory.service';
import type {
  MutationContext,
  MutationResult,
} from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import {
  PLANT_FOOTPRINT_STEPS,
  canPlaceAt,
  type PlacementCandidate,
  type PlacementReason,
} from '../simulation/placement-rules';
import { Decoration } from './decoration.entity';
import type { GardenCommandDto } from './dto/garden-command.dto';
import type { PlaceDecorationDto } from './dto/place-decoration.dto';
import type { PlantSeedDto } from './dto/plant-seed.dto';
import type { PositionDto } from './dto/position.dto';
import { Plant } from './plant.entity';

const GONE = "That isn't on your planet any more.";
const TAKEN = 'Something is already there. Try a free spot.';

/** What the player is told when a spot is refused (GRD-01 AC3, AC4). */
const REFUSALS: Record<Exclude<PlacementReason, 'ok'>, string> = {
  'planet-full': 'Your planet is full for now. Dig up a plant to make room.',
  'occupied-plant': TAKEN,
  'occupied-decoration': TAKEN,
  'occupied-water': 'That spot is a little too splashy. Try a dry one.',
};

// The DTOs let only content ids in, so every stored type is listed here.
const DECORATION_TYPES = Object.fromEntries(
  DECORATIONS.map((decoration) => [decoration.id, decoration]),
) as Record<DecorationId, DecorationType>;

/**
 * Planting and digging up, and placing, moving and putting away decorations
 * (GRD-01, GRD-07, ITM-02). Every command runs through mutate(), so a refusal
 * throws inside the transaction and leaves the planet and inventory as they
 * were.
 */
@Injectable()
export class GardenService {
  constructor(
    private readonly planetState: PlanetStateService,
    private readonly inventory: InventoryService,
  ) {}

  /** Plants one seed from the inventory at a free spot (GRD-01 AC1). */
  plant(planetId: string, body: PlantSeedDto): Promise<MutationResult> {
    const { itemType, lat, lon } = body;
    return this.planetState.mutate(
      planetId,
      body.expectedVersion,
      async (ctx) => {
        await this.checkSpot(ctx, {
          kind: 'plant',
          point: { lat, lon },
          footprintSteps: PLANT_FOOTPRINT_STEPS,
        });
        await this.inventory.consume(ctx.em, planetId, itemType);
        await ctx.em.insert(Plant, {
          planetId,
          type: itemType,
          lat,
          lon,
          stage: 'seed',
          growth: 0,
          water: 0.5,
          plantedAt: ctx.now,
        });
      },
    );
  }

  /** Removes a plant; a seed or sprout returns its seed (GRD-07 AC1). */
  digUp(
    planetId: string,
    plantId: string,
    body: GardenCommandDto,
  ): Promise<MutationResult> {
    return this.planetState.mutate(
      planetId,
      body.expectedVersion,
      async (ctx) => {
        const plant = await ctx.em.findOneBy(Plant, { id: plantId, planetId });
        if (!plant) {
          throw new NotFoundException(GONE);
        }
        await ctx.em.delete(Plant, { id: plant.id });
        if (plant.stage === 'seed' || plant.stage === 'sprout') {
          await this.giveBack(ctx, {
            itemType: plant.type,
            kind: 'seed',
            count: 1,
          });
        }
      },
    );
  }

  /** Places one decoration from the inventory at a free spot (ITM-02 AC1). */
  placeDecoration(
    planetId: string,
    body: PlaceDecorationDto,
  ): Promise<MutationResult> {
    const { itemType, lat, lon } = body;
    return this.planetState.mutate(
      planetId,
      body.expectedVersion,
      async (ctx) => {
        await this.checkSpot(ctx, {
          kind: 'decoration',
          point: { lat, lon },
          footprintSteps: DECORATION_TYPES[itemType].footprintSteps,
        });
        await this.inventory.consume(ctx.em, planetId, itemType);
        await ctx.em.insert(Decoration, {
          planetId,
          type: itemType,
          lat,
          lon,
          placedAt: ctx.now,
        });
      },
    );
  }

  /** Moves a placed decoration to a free spot (ITM-02 AC2). */
  moveDecoration(
    planetId: string,
    decorationId: string,
    body: PositionDto,
  ): Promise<MutationResult> {
    const { lat, lon } = body;
    return this.planetState.mutate(
      planetId,
      body.expectedVersion,
      async (ctx) => {
        const decoration = await this.findDecoration(ctx, decorationId);
        // It cannot be in its own way, so a short nudge is fine.
        await this.checkSpot(ctx, {
          kind: 'decoration',
          point: { lat, lon },
          footprintSteps: DECORATION_TYPES[decoration.type].footprintSteps,
          ignoreId: decoration.id,
        });
        await ctx.em.update(Decoration, { id: decoration.id }, { lat, lon });
      },
    );
  }

  /** Returns a placed decoration to the inventory (ITM-02 AC3). */
  putAwayDecoration(
    planetId: string,
    decorationId: string,
    body: GardenCommandDto,
  ): Promise<MutationResult> {
    return this.planetState.mutate(
      planetId,
      body.expectedVersion,
      async (ctx) => {
        const decoration = await this.findDecoration(ctx, decorationId);
        await ctx.em.delete(Decoration, { id: decoration.id });
        await this.giveBack(ctx, {
          itemType: decoration.type,
          kind: 'decoration',
          count: 1,
        });
      },
    );
  }

  /** Refuses with a 400 and the reason unless the candidate fits (GRD-01). */
  private async checkSpot(
    ctx: MutationContext,
    candidate: PlacementCandidate,
  ): Promise<void> {
    const planetId = ctx.planet.id;
    const plants = await ctx.em.findBy(Plant, { planetId });
    const decorations = await ctx.em.findBy(Decoration, { planetId });
    const reason = canPlaceAt(
      {
        plants,
        decorations: decorations.map(({ id, type, lat, lon }) => ({
          id,
          lat,
          lon,
          footprintSteps: DECORATION_TYPES[type].footprintSteps,
          isWater: DECORATION_TYPES[type].isWater,
        })),
        maxPlants: ctx.planet.maxPlants,
      },
      candidate,
    );
    if (reason !== 'ok') {
      throw new BadRequestException({
        statusCode: 400,
        message: REFUSALS[reason],
        reason,
      });
    }
  }

  /** The planet's decoration with this id, or a 404. */
  private async findDecoration(
    ctx: MutationContext,
    id: string,
  ): Promise<Decoration> {
    const decoration = await ctx.em.findOneBy(Decoration, {
      id,
      planetId: ctx.planet.id,
    });
    if (!decoration) {
      throw new NotFoundException(GONE);
    }
    return decoration;
  }

  /** Puts an item back into the inventory, announcing it if new. */
  private async giveBack(ctx: MutationContext, item: GrantItem): Promise<void> {
    const { newlyUnlocked } = await this.inventory.grant(
      ctx.em,
      ctx.planet.id,
      [item],
      ctx.now,
    );
    ctx.newlyUnlocked.push(...newlyUnlocked);
  }
}
