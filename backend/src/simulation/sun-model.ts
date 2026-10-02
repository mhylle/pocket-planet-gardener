import { angularDistance, type SurfacePoint } from './surface-coords';

/**
 * The light plants count as getting while the player is away (TIM-01 AC4).
 * The growth rules spell it 'away' rather than 0.5, because it partly meets
 * every preference, a shade plant's included.
 */
export const AVERAGE_LIGHT = 0.5;

/** Where the player last dragged the sun to, and when (GRD-03). */
export interface SunOverride {
  angle: number;
  at: Date;
}

const MS_PER_MINUTE = 60_000;

/**
 * The longitude the sun stands over at time t, in degrees from 0 up to 360.
 * It drifts once round the planet every dayMinutes. After a drag it holds
 * still for holdMinutes, then drifts on from where it was left, so it never
 * jumps (GRD-03 AC2).
 */
export function sunAngleAt(
  t: Date,
  dayMinutes: number,
  override: SunOverride | null,
  holdMinutes: number,
): number {
  const dayMs = dayMinutes * MS_PER_MINUTE;
  if (!override) {
    return normalise(driftDegrees(t.getTime(), dayMs));
  }
  const drifted =
    t.getTime() - override.at.getTime() - holdMinutes * MS_PER_MINUTE;
  if (drifted <= 0) {
    return normalise(override.angle);
  }
  return normalise(override.angle + driftDegrees(drifted, dayMs));
}

/**
 * The sunlight on a point, 0..1: full under the sun, fading towards the edge
 * of the lit half, and none on the night side.
 */
export function lightAt(point: SurfacePoint, sunAngle: number): number {
  const subsolar = { lat: 0, lon: sunAngle };
  return Math.max(0, Math.cos(angularDistance(point, subsolar)));
}

/** How far the sun drifts in ms; the remainder first keeps the digits. */
function driftDegrees(ms: number, dayMs: number): number {
  return ((ms % dayMs) / dayMs) * 360;
}

function normalise(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
