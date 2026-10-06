/** With less light than this on its spot, a creature naps (NAV-04 AC2). */
export const NAP_LIGHT = 0.1;

/**
 * Whether a creature naps with this much sunlight on its spot (0 on the night side, 1 under the
 * sun). The scene lays it down by this rule and its card says so, so the two always agree.
 */
export function isNapping(light: number): boolean {
  return light < NAP_LIGHT;
}
