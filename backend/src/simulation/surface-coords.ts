/*
 * Positions on a planet's surface (plan D-10). This file exists twice, in
 * backend/src/simulation and frontend/src/app/core/helpers, and the backend
 * spec fails when the copies differ: change both together. The 80-column
 * backend Prettier and the 100-column frontend one must both leave it as it
 * is, hence the prettier-ignore on the one wrapped signature.
 */

/** A point on the surface in degrees: lat -90..90, lon -180..180. */
export interface SurfacePoint {
  lat: number;
  lon: number;
}

/** A position in planet space. y is up; lat 0, lon 0 faces +z. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The arc of one step across the surface, in radians (5 degrees). */
export const STEP_ARC = Math.PI / 36;

const RADIANS_PER_DEGREE = Math.PI / 180;

/** The position of a surface point on a sphere of the given radius. */
export function toVector(point: SurfacePoint, radius: number): Vec3 {
  const lat = point.lat * RADIANS_PER_DEGREE;
  const lon = point.lon * RADIANS_PER_DEGREE;
  return {
    x: radius * Math.cos(lat) * Math.sin(lon),
    y: radius * Math.sin(lat),
    z: radius * Math.cos(lat) * Math.cos(lon),
  };
}

/**
 * The surface point in the direction of a vector, whatever its length.
 * Longitude comes back in (-180, 180]; at a pole it carries no meaning.
 */
export function fromVector(v: Vec3): SurfacePoint {
  const lat = Math.atan2(v.y, Math.hypot(v.x, v.z)) / RADIANS_PER_DEGREE;
  const lon = Math.atan2(v.x, v.z) / RADIANS_PER_DEGREE;
  return { lat, lon: lon === -180 ? 180 : lon };
}

/** The angle between two surface points, in radians from 0 to pi. */
export function angularDistance(a: SurfacePoint, b: SurfacePoint): number {
  // atan2 of the cross and dot products keeps its precision for points very
  // close together or almost opposite, where acos and asin lose digits.
  const u = toVector(a, 1);
  const v = toVector(b, 1);
  const cx = u.y * v.z - u.z * v.y;
  const cy = u.z * v.x - u.x * v.z;
  const cz = u.x * v.y - u.y * v.x;
  const dot = u.x * v.x + u.y * v.y + u.z * v.z;
  return Math.atan2(Math.hypot(cx, cy, cz), dot);
}

/** How many steps apart two surface points are; may be fractional. */
// prettier-ignore
export function stepsBetween(
  a: SurfacePoint,
  b: SurfacePoint,
  stepArc = STEP_ARC,
): number {
  return angularDistance(a, b) / stepArc;
}
