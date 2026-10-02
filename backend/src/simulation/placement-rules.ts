/*
 * Where a plant or decoration may go (plan D-10, GRD-01). This file exists
 * twice, in backend/src/simulation and frontend/src/app/core/helpers, and the
 * backend spec fails when the copies differ: change both together. The
 * 80-column backend Prettier and the 100-column frontend one must both leave
 * it as it is, hence the prettier-ignore on the wrapped union and signature.
 */
import { stepsBetween, type SurfacePoint } from './surface-coords';

/** Why a spot is refused, or 'ok'. */
// prettier-ignore
export type PlacementReason =
  | 'ok'
  | 'occupied-plant'
  | 'occupied-decoration'
  | 'occupied-water'
  | 'planet-full';

/** How many steps across a plant takes up, whatever its stage. */
export const PLANT_FOOTPRINT_STEPS = 1;

export interface PlacedPlant {
  id: string;
  lat: number;
  lon: number;
}

export interface PlacedDecoration {
  id: string;
  lat: number;
  lon: number;
  /** Steps across, from the decoration's content entry. */
  footprintSteps: number;
  /** Water, such as the pond, refuses with its own reason. */
  isWater: boolean;
}

/** What is already on the planet. */
export interface PlacementState {
  plants: PlacedPlant[];
  decorations: PlacedDecoration[];
  maxPlants: number;
}

/** The thing to place, and where. */
export interface PlacementCandidate {
  kind: 'plant' | 'decoration';
  point: SurfacePoint;
  /** Steps across. */
  footprintSteps: number;
  /** The plant or decoration being moved, which cannot be in its own way. */
  ignoreId?: string;
}

/** Whether the planet holds as many plants as it can (GRD-01 AC4). */
export function isPlanetFull(state: PlacementState): boolean {
  return state.plants.length >= state.maxPlants;
}

/**
 * Whether the candidate fits at its point. A new plant on a full planet is
 * refused first. Otherwise each object is a circle of half its footprint, and
 * two clash when their centres are closer than the sum of their radii. If the
 * candidate clashes with several things, water wins over other decorations,
 * and decorations over plants.
 */
// prettier-ignore
export function canPlaceAt(
  state: PlacementState,
  candidate: PlacementCandidate,
): PlacementReason {
  const isNewPlant = candidate.kind === 'plant' && !candidate.ignoreId;
  if (isNewPlant && isPlanetFull(state)) {
    return 'planet-full';
  }

  const radius = candidate.footprintSteps / 2;
  const overlaps = (other: PlacedPlant, footprintSteps: number): boolean => {
    if (other.id === candidate.ignoreId) {
      return false;
    }
    const reach = radius + footprintSteps / 2;
    return stepsBetween(candidate.point, other) < reach;
  };

  const hit = state.decorations.filter((d) => overlaps(d, d.footprintSteps));
  if (hit.some((d) => d.isWater)) {
    return 'occupied-water';
  }
  if (hit.length > 0) {
    return 'occupied-decoration';
  }
  if (state.plants.some((p) => overlaps(p, PLANT_FOOTPRINT_STEPS))) {
    return 'occupied-plant';
  }
  return 'ok';
}
