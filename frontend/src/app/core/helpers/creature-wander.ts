import { STEP_ARC, SurfacePoint, angularDistance, fromVector, toVector } from './surface-coords';

/** How far from its home spot a creature wanders, in steps. */
export const WANDER_RADIUS_STEPS = 1.5;
/** The longest single walk between two resting spots, in steps. */
export const MAX_STRIDE_STEPS = 0.8;

const RADIANS_PER_DEGREE = Math.PI / 180;

/**
 * Where a creature walks to next from where it is (NAV-04 AC1): a random spot around its home,
 * spread evenly over the ground within WANDER_RADIUS_STEPS of it, and no more than
 * MAX_STRIDE_STEPS from where the creature is. A creature further from home than the radius
 * (its home moved) heads for a spot near home however far it is. rng gives numbers in [0, 1),
 * like Math.random. The spot is always a point on the surface, so the creature never leaves it.
 */
export function wanderStep(
  home: SurfacePoint,
  current: SurfacePoint,
  rng: () => number,
): SurfacePoint {
  // The square root spreads the spots evenly instead of bunching them up around home.
  const reach = Math.sqrt(rng()) * WANDER_RADIUS_STEPS * STEP_ARC;
  const spot = offset(home, rng() * 2 * Math.PI, reach);
  const stride = angularDistance(current, spot) / STEP_ARC;
  const strayed = angularDistance(home, current) > WANDER_RADIUS_STEPS * STEP_ARC;
  // Both ends lie within the radius, so every point on the way between them does too.
  return strayed || stride <= MAX_STRIDE_STEPS
    ? spot
    : along(current, spot, MAX_STRIDE_STEPS / stride);
}

/**
 * The point a fraction of the way from a to b along the surface, on the shorter way round:
 * a at 0, b at 1.
 */
export function along(a: SurfacePoint, b: SurfacePoint, fraction: number): SurfacePoint {
  const angle = angularDistance(a, b);
  const sine = Math.sin(angle);
  // Too close together (or exactly opposite) to tell a way between them.
  if (sine < 1e-9) {
    return fraction < 0.5 ? { ...a } : { ...b };
  }
  const u = toVector(a, 1);
  const v = toVector(b, 1);
  const wa = Math.sin((1 - fraction) * angle) / sine;
  const wb = Math.sin(fraction * angle) / sine;
  return fromVector({ x: wa * u.x + wb * v.x, y: wa * u.y + wb * v.y, z: wa * u.z + wb * v.z });
}

/** The point an angle (radians) away from the start, heading for a bearing (radians from north). */
function offset(start: SurfacePoint, bearing: number, angle: number): SurfacePoint {
  const lat = start.lat * RADIANS_PER_DEGREE;
  const lon = start.lon * RADIANS_PER_DEGREE;
  const sinLat =
    Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(bearing);
  const endLat = Math.asin(Math.min(1, Math.max(-1, sinLat)));
  const endLon =
    lon +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angle) * Math.cos(lat),
      Math.cos(angle) - Math.sin(lat) * sinLat,
    );
  // Through a vector and back, so the longitude comes out within -180..180.
  return fromVector(
    toVector({ lat: endLat / RADIANS_PER_DEGREE, lon: endLon / RADIANS_PER_DEGREE }, 1),
  );
}
