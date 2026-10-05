import type {
  ArrivalCondition,
  DecorationId,
  PlantId,
  SpeciesId,
} from '../content/content.types';
import { SPECIES } from '../content/species';

const MINUTE_MS = 60_000;

/** What the arrival conditions look at: the planet's blooms and decorations. */
export interface GardenView {
  // Blooming plants per type; a type with none may be left out.
  blooming: Partial<Record<PlantId, number>>;
  // The decoration types placed on the planet.
  decorations: ReadonlySet<DecorationId>;
  // How many plant types are in bloom.
  distinctBlooming: number;
  anyBloom: boolean;
}

/**
 * Kept on the planet as arrival_tracking: since when each species' condition
 * has held, and when the last creature arrived. ISO timestamps; metSince is
 * null while the condition is not met. A new planet holds {}.
 */
export interface ArrivalTracking {
  species: Partial<Record<SpeciesId, { metSince: string | null }>>;
  lastArrivalAt: string | null;
}

/** The tunables of CRT-01 and CRT-02, under GameConfigService's names. */
export interface ArrivalTunables {
  arrivalDelaySeconds: number;
  arrivalSpacingMinutes: number;
  maxCreatures: number;
  maxPerSpecies: number;
}

export interface ArrivalInput {
  garden: GardenView;
  // The creatures living on the planet.
  creatures: readonly { species: SpeciesId }[];
  tracking: Partial<ArrivalTracking>;
  now: Date;
  // The player was away since the last sync: a met condition needs no delay.
  away: boolean;
  cfg: ArrivalTunables;
}

/** The garden as the conditions see it: a plant counts once it is in bloom. */
export function gardenView(
  plants: readonly { type: PlantId; stage: string }[],
  decorations: readonly { type: DecorationId }[],
): GardenView {
  const blooming: Partial<Record<PlantId, number>> = {};
  for (const plant of plants) {
    if (plant.stage === 'bloom') {
      blooming[plant.type] = (blooming[plant.type] ?? 0) + 1;
    }
  }
  const distinctBlooming = Object.keys(blooming).length;
  return {
    blooming,
    decorations: new Set(decorations.map((decoration) => decoration.type)),
    distinctBlooming,
    anyBloom: distinctBlooming > 0,
  };
}

/** Whether the garden meets a species' arrival condition (CRT-01). */
export function isConditionMet(
  condition: ArrivalCondition,
  garden: GardenView,
): boolean {
  switch (condition.kind) {
    case 'first-bloom':
      return garden.anyBloom;
    case 'blooming':
      return (garden.blooming[condition.plant] ?? 0) >= condition.count;
    case 'decoration':
      return garden.decorations.has(condition.decoration);
    case 'distinct-blooming':
      return garden.distinctBlooming >= condition.count;
    case 'all':
      return condition.of.every((part) => isConditionMet(part, garden));
  }
}

/**
 * The placed things that make up a condition, for the creature to settle
 * beside: its decorations first, then its blooms, any bloom where the
 * condition asks for blooms of no one type.
 */
export function attractions<
  P extends { type: PlantId; stage: string },
  D extends { type: DecorationId },
>(
  condition: ArrivalCondition,
  plants: readonly P[],
  decorations: readonly D[],
): (P | D)[] {
  const wanted = {
    plants: new Set<PlantId>(),
    decorations: new Set<DecorationId>(),
    anyBloom: false,
  };
  const collect = (part: ArrivalCondition): void => {
    switch (part.kind) {
      case 'first-bloom':
      case 'distinct-blooming':
        wanted.anyBloom = true;
        break;
      case 'blooming':
        wanted.plants.add(part.plant);
        break;
      case 'decoration':
        wanted.decorations.add(part.decoration);
        break;
      case 'all':
        part.of.forEach(collect);
    }
  };
  collect(condition);
  return [
    ...decorations.filter((decoration) =>
      wanted.decorations.has(decoration.type),
    ),
    ...plants.filter(
      (plant) =>
        plant.stage === 'bloom' &&
        (wanted.anyBloom || wanted.plants.has(plant.type)),
    ),
  ];
}

/**
 * Which species moves in now, if any, and the tracking to store. A species
 * is due once its condition has held for arrivalDelaySeconds, or at once
 * after away time (CRT-01 AC1) or for the planet's first creature ever
 * (ONB-02 AC2), while it has fewer than maxPerSpecies
 * creatures (CRT-02 AC2), or none yet for a first-bloom condition such as
 * the worm's. At most one arrives, the first due in species
 * order, none while the planet has maxCreatures (CRT-02 AC1) or within
 * arrivalSpacingMinutes of the last arrival (CRT-01 AC3).
 */
export function evaluateArrivals(input: ArrivalInput): {
  arrival: SpeciesId | null;
  tracking: ArrivalTracking;
} {
  const { garden, creatures, now, away, cfg } = input;
  const previous = input.tracking.species ?? {};
  const lastArrivalAt = input.tracking.lastArrivalAt ?? null;
  // Creatures never leave, so none living and none on record means none yet.
  const first = creatures.length === 0 && lastArrivalAt === null;
  const species: ArrivalTracking['species'] = {};
  const due: SpeciesId[] = [];
  for (const { id, arrivalCondition } of SPECIES) {
    if (!isConditionMet(arrivalCondition, garden)) {
      species[id] = { metSince: null };
      continue;
    }
    const metSince = previous[id]?.metSince ?? now.toISOString();
    species[id] = { metSince };
    const waited =
      now.getTime() - Date.parse(metSince) >= cfg.arrivalDelaySeconds * 1000;
    const living = creatures.filter((creature) => creature.species === id);
    // The first bloom happens once, so it brings one creature, not two.
    const cap = arrivalCondition.kind === 'first-bloom' ? 1 : cfg.maxPerSpecies;
    if ((away || first || waited) && living.length < cap) {
      due.push(id);
    }
  }

  const spaced =
    lastArrivalAt === null ||
    Date.parse(lastArrivalAt) + cfg.arrivalSpacingMinutes * MINUTE_MS <=
      now.getTime();
  const roomy = creatures.length < cfg.maxCreatures;
  const arrival = roomy && spaced ? (due[0] ?? null) : null;
  return {
    arrival,
    tracking: {
      species,
      lastArrivalAt: arrival ? now.toISOString() : lastArrivalAt,
    },
  };
}
