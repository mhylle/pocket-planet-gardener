import { canPlaceAt, type PlacementState } from '../simulation/placement-rules';
import {
  STEP_ARC,
  stepsBetween,
  type SurfacePoint,
} from '../simulation/surface-coords';

const RADIANS_PER_DEGREE = Math.PI / 180;

/** A home takes up one step across, like a plant. */
const HOME_STEPS = 1;

/**
 * The rings around an anchor a home is looked for on, in steps. Half a step
 * past whole steps, so a ring never grazes the edge of a footprint, where
 * rounding decides.
 */
const RING_STEPS = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5];

/** The bearings tried on each ring around an anchor, in degrees apart. */
const BEARING_DEGREES = 30;

/** The latitudes and longitude spacing of the planet-wide search, in degrees. */
const GRID_LATS = [0, 20, -20, 40, -40, 60, -60];
const GRID_LON_DEGREES = 15;

/**
 * Where an arriving creature makes its home (Task 11.4): the free spot
 * nearest the first anchor that has one, such as the pond or a clover that
 * drew it, else the first free spot of a coarse grid over the planet. A spot
 * is free when a one-step object fits there by the placement rules and no
 * other creature lives within a step. Homes never block planting.
 */
export function chooseHomeSpot(
  state: PlacementState,
  homes: readonly SurfacePoint[],
  anchors: readonly SurfacePoint[],
): SurfacePoint {
  const isFree = (point: SurfacePoint): boolean =>
    canPlaceAt(state, {
      kind: 'decoration',
      point,
      footprintSteps: HOME_STEPS,
    }) === 'ok' && homes.every((home) => stepsBetween(home, point) >= 1);

  for (const anchor of anchors) {
    for (const ring of RING_STEPS) {
      for (let bearing = 0; bearing < 360; bearing += BEARING_DEGREES) {
        const point = offset(anchor, ring, bearing);
        if (isFree(point)) {
          return point;
        }
      }
    }
  }
  for (const lat of GRID_LATS) {
    for (let lon = -180; lon < 180; lon += GRID_LON_DEGREES) {
      if (isFree({ lat, lon })) {
        return { lat, lon };
      }
    }
  }
  // A planet too crowded for even that: the creature shares its anchor.
  return anchors[0] ?? { lat: 0, lon: 0 };
}

/** The point some steps from start along a bearing, in degrees east of north. */
function offset(
  start: SurfacePoint,
  steps: number,
  bearing: number,
): SurfacePoint {
  const lat1 = start.lat * RADIANS_PER_DEGREE;
  const lon1 = start.lon * RADIANS_PER_DEGREE;
  const arc = steps * STEP_ARC;
  const heading = bearing * RADIANS_PER_DEGREE;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(arc) +
      Math.cos(lat1) * Math.sin(arc) * Math.cos(heading),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(heading) * Math.sin(arc) * Math.cos(lat1),
      Math.cos(arc) - Math.sin(lat1) * Math.sin(lat2),
    );
  const lon = lon2 / RADIANS_PER_DEGREE;
  return {
    lat: lat2 / RADIANS_PER_DEGREE,
    // Back into -180..180.
    lon: ((((lon + 180) % 360) + 360) % 360) - 180,
  };
}
