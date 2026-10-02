import table from './surface-coords.fixtures.json';
import {
  STEP_ARC,
  angularDistance,
  fromVector,
  stepsBetween,
  toVector,
  type SurfacePoint,
  type Vec3,
} from './surface-coords';

/** A point, its position on a sphere and where that position maps back to. */
interface PointCase {
  name: string;
  point: SurfacePoint;
  radius: number;
  /** lon is left out at the poles, where it carries no meaning. */
  expect: { vector: Vec3; point: { lat: number; lon?: number } };
}

/** Two points and how far apart they are. */
interface PairCase {
  name: string;
  a: SurfacePoint;
  b: SurfacePoint;
  expect: { radians: number; steps: number };
}

interface Fixtures {
  points: PointCase[];
  pairs: PairCase[];
}

// The backend spec checks that this table and the helper match its copies.
const fixtures: Fixtures = table;

/** Digits for values computed from exact inputs. */
const EXACT = 12;
/** Digits for a round trip, in degrees: an error below 1e-6 (Task 4.1). */
const ROUND_TRIP = 6;

describe('surface coords', () => {
  describe.each(fixtures.points)('$name', ({ point, radius, expect: want }) => {
    it('maps to the expected vector', () => {
      const v = toVector(point, radius);

      expect(v.x).toBeCloseTo(want.vector.x, EXACT);
      expect(v.y).toBeCloseTo(want.vector.y, EXACT);
      expect(v.z).toBeCloseTo(want.vector.z, EXACT);
    });

    it('round-trips through fromVector, with lon in (-180, 180]', () => {
      const back = fromVector(toVector(point, radius));

      expect(back.lat).toBeCloseTo(want.point.lat, ROUND_TRIP);
      if (want.point.lon !== undefined) {
        expect(back.lon).toBeCloseTo(want.point.lon, ROUND_TRIP);
      }
      expect(back.lon).toBeGreaterThan(-180);
      expect(back.lon).toBeLessThanOrEqual(180);
    });
  });

  describe.each(fixtures.pairs)('$name', ({ a, b, expect: want }) => {
    it('is the expected angle apart, either way round', () => {
      expect(angularDistance(a, b)).toBeCloseTo(want.radians, EXACT);
      expect(angularDistance(b, a)).toBeCloseTo(want.radians, EXACT);
    });

    it('is the expected number of steps apart', () => {
      expect(stepsBetween(a, b)).toBeCloseTo(want.steps, EXACT);
    });
  });

  it('has antipodes at exactly pi and a single step at STEP_ARC', () => {
    const radians = fixtures.pairs.map((pair) => pair.expect.radians);

    expect(radians).toContain(Math.PI);
    expect(radians).toContain(STEP_ARC);
  });

  it('turns the -180 that atan2 can return into 180', () => {
    expect(fromVector({ x: -0, y: 0, z: -1 }).lon).toBe(180);
  });

  it('counts steps of a given arc', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 90 };

    expect(stepsBetween(a, b, Math.PI / 4)).toBeCloseTo(2, EXACT);
  });
});
