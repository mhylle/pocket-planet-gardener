import { seededRandom as seeded } from '../../testing/seeded-random';
import { MAX_STRIDE_STEPS, WANDER_RADIUS_STEPS, along, wanderStep } from './creature-wander';
import { SurfacePoint, stepsBetween, toVector } from './surface-coords';

function expectOnSurface({ lat, lon }: SurfacePoint) {
  expect(Number.isFinite(lat) && Number.isFinite(lon)).toBe(true);
  expect(lat).toBeGreaterThanOrEqual(-90);
  expect(lat).toBeLessThanOrEqual(90);
  expect(lon).toBeGreaterThan(-180);
  expect(lon).toBeLessThanOrEqual(180);
  const { x, y, z } = toVector({ lat, lon }, 1);
  expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
}

describe('wanderStep', () => {
  const HOMES: SurfacePoint[] = [
    { lat: 0, lon: 0 },
    { lat: 35, lon: -120 },
    { lat: -12, lon: 179.5 },
    { lat: 89.5, lon: 40 },
    { lat: -90, lon: 0 },
  ];

  it.each(HOMES)(
    'never leaves the surface and stays near home over 1000 steps from %o (NAV-04 AC1)',
    (home) => {
      const rng = seeded(7);
      let current = home;
      let furthest = 0;
      for (let step = 0; step < 1000; step++) {
        const next = wanderStep(home, current, rng);
        expectOnSurface(next);
        expect(stepsBetween(home, next)).toBeLessThanOrEqual(WANDER_RADIUS_STEPS + 1e-9);
        expect(stepsBetween(current, next)).toBeLessThanOrEqual(MAX_STRIDE_STEPS + 1e-9);
        furthest = Math.max(furthest, stepsBetween(home, next));
        current = next;
      }
      // It really wanders, out to most of its range.
      expect(furthest).toBeGreaterThan(WANDER_RADIUS_STEPS * 0.8);
    },
  );

  it('heads back to a spot near home from far away', () => {
    const home = { lat: 10, lon: 20 };
    const next = wanderStep(home, { lat: 40, lon: 60 }, seeded(3));

    expect(stepsBetween(home, next)).toBeLessThanOrEqual(WANDER_RADIUS_STEPS);
  });
});

describe('along', () => {
  const a = { lat: 0, lon: 0 };
  const b = { lat: 0, lon: 10 };

  it('runs from a to b along the surface', () => {
    expect(along(a, b, 0).lon).toBeCloseTo(0, 9);
    expect(along(a, b, 1).lon).toBeCloseTo(10, 9);
    const half = along(a, b, 0.5);
    expect(half.lat).toBeCloseTo(0, 9);
    expect(half.lon).toBeCloseTo(5, 9);
  });

  it('gives one of the points when they are too close to tell a way', () => {
    expect(along(a, a, 0.3)).toEqual(a);
  });
});
