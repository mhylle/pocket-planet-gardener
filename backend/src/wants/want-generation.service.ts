import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai/ai-gateway.service';
import type { PlanetPublicState } from '../ai/prompt-context';
import { RandomService } from '../common/random.service';
import type { SpeciesId } from '../content/content.types';
import { DECORATIONS } from '../content/decorations';
import {
  decorationName,
  FALLBACK_WANTS,
  fillWantTemplate,
  plantName,
} from '../content/fallback-wants';
import { PLANTS } from '../content/plants';
import type { CreatureIdentity } from '../creatures/identity.types';
import {
  describe,
  type Home,
  type WantAnchor,
  type WantSpec,
  type WantType,
  type WantWorld,
} from './want-evaluator';
import {
  allowedWantTypes,
  bringBackSpec,
  buildWantPrompt,
  parseWant,
  WANT_TEXT_LIMITS,
  wantProblems,
  type BringBackItem,
  type WantRules,
  type WrittenWant,
} from './want-prompt';

/** What WantGenerationService.generate needs for a creature's next want. */
export interface WantRequest {
  // Logged with the AI usage row only; never part of the prompt (AIB-02).
  planetId: string;
  creature: {
    id: string;
    species: SpeciesId;
    name: string;
    identity: CreatureIdentity;
    home: Home;
  };
  memories: readonly string[];
  planet: PlanetPublicState;
  world: WantWorld;
  unlocked: ReadonlySet<string>;
  maxPlants: number;
  plantCount: number;
  // The tutorial creature's first want: one the items in owned can meet now (ONB-02 AC3).
  tutorial?: boolean;
  // Item type to how many the planet holds now.
  owned?: ReadonlyMap<string, number>;
  // A wistful creature asks for this back, and for nothing else (CRT-04 AC3).
  bringBack?: BringBackItem;
}

/** A new want, ready to store and show. */
export interface GeneratedWant {
  spec: WantSpec;
  // The creature's own words (WNT-01 AC3).
  text: string;
  // Such as "2 moonflowers within 3 steps of the lamp-post" (WNT-02 AC2).
  plainDescription: string;
  source: 'ai' | 'fallback';
}

/** The small numbers fallback wants are made with, for a cosy pace. */
const FALLBACK_NUMBERS = {
  nearCounts: [1, 2],
  bloomCounts: [1, 2, 3],
  distinct: [2, 3],
  withinSteps: 3,
};

/**
 * Makes a creature's next want (WNT-02): asked of the model through the
 * gateway and kept only when it is achievable, fits the tutorial or the
 * bring-back it must be and passes the content rules; otherwise one from
 * the pre-written pool, filled with the planet's real items (AIB-05). An
 * invalid want is never returned (WNT-02 AC4).
 */
@Injectable()
export class WantGenerationService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly random: RandomService,
  ) {}

  /** Never throws; can take up to the AI timeout (see AiGatewayService.generate). */
  async generate(request: WantRequest): Promise<GeneratedWant> {
    const rules: WantRules = { ...request, home: request.creature.home };
    const result = await this.gateway.generate<WrittenWant>({
      feature: 'want',
      planetId: request.planetId,
      messages: buildWantPrompt(request),
      parse: parseWant,
      validate: (want) => wantProblems(want.spec, rules),
      texts: (want) => [want.text],
      limits: WANT_TEXT_LIMITS,
      fallback: () => this.fallback(request, rules),
    });
    const { spec, text } = result.value;
    const plainDescription = describe(spec, {
      plant: plantName,
      decoration: decorationName,
      creatureName: request.creature.name,
    });
    return { spec, text, plainDescription, source: result.source };
  }

  /**
   * A random valid want from the pool: first a want type with any valid
   * want, so types with many variants are not favoured, then one of its
   * wants, then one of the species' lines for that type.
   */
  private fallback(request: WantRequest, rules: WantRules): WrittenWant {
    const choices = allowedWantTypes(request.bringBack)
      .map((type) =>
        candidates(type, request).filter(
          (spec) => wantProblems(spec, rules).length === 0,
        ),
      )
      .filter((specs) => specs.length > 0);
    const spec =
      choices.length > 0
        ? this.random.pick(this.random.pick(choices))
        : lastResort(request);
    const lines = FALLBACK_WANTS[request.creature.species][spec.type];
    return { spec, text: fillWantTemplate(this.random.pick(lines), spec) };
  }
}

/** Every want of the type the pool can make from the planet's items, valid or not. */
function candidates(type: WantType, request: WantRequest): WantSpec[] {
  const { nearCounts, bloomCounts, distinct, withinSteps } = FALLBACK_NUMBERS;
  const plants = PLANTS.filter((plant) => request.unlocked.has(plant.id));
  switch (type) {
    case 'plant-near': {
      // Home, or a decoration that is on the planet already.
      const anchors: WantAnchor[] = [
        { kind: 'home' },
        ...DECORATIONS.filter((decoration) =>
          request.world.decorations.some((each) => each.type === decoration.id),
        ).map((decoration) => ({
          kind: 'decoration' as const,
          decoration: decoration.id,
        })),
      ];
      return plants.flatMap((plant) =>
        anchors.flatMap((near) =>
          nearCounts.map((count) => ({
            type,
            plant: plant.id,
            count,
            near,
            withinSteps,
          })),
        ),
      );
    }
    case 'count-blooming':
      return plants.flatMap((plant) =>
        bloomCounts.map((count) => ({ type, plant: plant.id, count })),
      );
    case 'place-decoration':
      return DECORATIONS.filter((decoration) =>
        request.unlocked.has(decoration.id),
      ).map((decoration) => ({ type, decoration: decoration.id }));
    case 'variety':
      return distinct.map((each) => ({ type, distinct: each, withinSteps }));
    case 'bring-back':
      return request.bringBack ? [bringBackSpec(request.bringBack)] : [];
  }
}

/**
 * The want used when the pool has no valid one: the asked-for bring-back,
 * or one bloom of a plant the player holds or has unlocked. It may already
 * be met, or (in the tutorial) need seeds the player lacks.
 */
function lastResort(request: WantRequest): WantSpec {
  if (request.bringBack) {
    return bringBackSpec(request.bringBack);
  }
  const unlocked = PLANTS.filter((plant) => request.unlocked.has(plant.id));
  const held = unlocked.find(
    (plant) => (request.owned?.get(plant.id) ?? 0) > 0,
  );
  const plant = held ?? unlocked[0] ?? PLANTS[0];
  return { type: 'count-blooming', plant: plant.id, count: 1 };
}
