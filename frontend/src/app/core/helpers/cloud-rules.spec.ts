import table from './cloud-rules.fixtures.json';
import {
  MIN_RAIN_WATER,
  cloudAt,
  drainSeconds,
  initialClouds,
  type CloudPosition,
  type CloudState,
  type CloudTunables,
  type Rain,
} from './cloud-rules';

interface Fixtures {
  tunables: CloudTunables;
  minRainWater: number;
  cloudAt: { name: string; cloud: CloudState; now: string; expect: CloudPosition }[];
  drainSeconds: { name: string; water: number; seconds: number; expect: Rain }[];
  initialClouds: { count: number; now: string; expect: CloudState[] };
}

// The backend spec checks that this table and the helper match its copies.
const fixtures: Fixtures = table;
const { tunables } = fixtures;

/** Digits for values computed from exact inputs. */
const EXACT = 12;
const T0 = new Date('2030-01-01T00:00:00.000Z');

function after(seconds: number): Date {
  return new Date(T0.getTime() + seconds * 1000);
}

/** How far east b lies from a, in degrees from -180 up to 180. */
function eastward(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

describe('cloud rules', () => {
  describe('cloudAt', () => {
    it.each(fixtures.cloudAt)('$name', ({ cloud, now, expect: want }) => {
      const position = cloudAt(cloud, new Date(now), tunables);

      expect(position.lat).toBeCloseTo(want.lat, EXACT);
      expect(position.lon).toBeCloseTo(want.lon, EXACT);
      expect(position.water).toBeCloseTo(want.water, EXACT);
    });

    it('refills an empty cloud to 1 after refillSeconds, not before', () => {
      const empty = { id: 'c', lat: 0, lon: 0, water: 0, at: T0.toISOString() };
      const refill = tunables.refillSeconds;

      expect(cloudAt(empty, after(refill - 1), tunables).water).toBeLessThan(1);
      expect(cloudAt(empty, after(refill), tunables).water).toBe(1);
    });

    it('rests an emptied cloud a fifth of refillSeconds before it can rain', () => {
      const empty = { id: 'c', lat: 0, lon: 0, water: 0, at: T0.toISOString() };
      const rest = tunables.refillSeconds * fixtures.minRainWater;

      expect(MIN_RAIN_WATER).toBe(fixtures.minRainWater);
      expect(rest).toBe(12);
      expect(cloudAt(empty, after(rest - 0.1), tunables).water).toBeLessThan(MIN_RAIN_WATER);
      expect(cloudAt(empty, after(rest), tunables).water).toBeGreaterThanOrEqual(MIN_RAIN_WATER);
    });

    it('drifts continuously and keeps lon within (-180, 180]', () => {
      const cloud = { id: 'c', lat: 10, lon: 0, water: 1, at: T0.toISOString() };
      // 0.1 degrees a second at 6 degrees a minute.
      const perSecond = tunables.driftDegreesPerMinute / 60;
      let previous = cloudAt(cloud, T0, tunables).lon;

      for (let second = 1; second <= 2 * 3600; second++) {
        const { lat, lon } = cloudAt(cloud, after(second), tunables);

        expect(lat).toBe(10);
        expect(lon).toBeGreaterThan(-180);
        expect(lon).toBeLessThanOrEqual(180);
        expect(eastward(previous, lon)).toBeCloseTo(perSecond, 9);
        previous = lon;
      }
    });
  });

  describe('drainSeconds', () => {
    it.each(fixtures.drainSeconds)('$name', ({ water, seconds, expect: want }) => {
      const rain = drainSeconds(water, seconds, tunables);

      expect(rain.water).toBeCloseTo(want.water, EXACT);
      expect(rain.rained).toBeCloseTo(want.rained, EXACT);
    });

    it.each([
      [8, 1],
      [8, 2],
      [10, 1],
      [7, 0.5],
    ])(
      'empties a full cloud after exactly rainSeconds %d of rain, %d s at a time',
      (rainSeconds, step) => {
        const t = { ...tunables, rainSeconds };
        let water = 1;
        let rained = 0;

        for (let spell = 0; spell < rainSeconds / step; spell++) {
          expect(water).toBeGreaterThan(0);
          const rain = drainSeconds(water, step, t);
          water = rain.water;
          rained += rain.rained;
        }

        expect(water).toBe(0);
        expect(rained).toBeCloseTo(rainSeconds, EXACT);
        expect(drainSeconds(water, step, t)).toEqual({ water: 0, rained: 0 });
      },
    );
  });

  describe('initialClouds', () => {
    it('makes full clouds spread round the planet', () => {
      const { count, now, expect: want } = fixtures.initialClouds;

      expect(initialClouds(count, new Date(now))).toEqual(want);
    });

    it('spaces any number of clouds evenly, with unique ids', () => {
      const clouds = initialClouds(5, T0);

      expect(new Set(clouds.map((cloud) => cloud.id)).size).toBe(5);
      clouds.forEach((cloud, i) => {
        const next = clouds[(i + 1) % clouds.length];
        expect(eastward(cloud.lon, next.lon)).toBeCloseTo(72, EXACT);
        expect(cloud.lon).toBeGreaterThan(-180);
        expect(cloud.lon).toBeLessThanOrEqual(180);
      });
    });

    it('makes none for a count of 0', () => {
      expect(initialClouds(0, T0)).toEqual([]);
    });
  });
});
