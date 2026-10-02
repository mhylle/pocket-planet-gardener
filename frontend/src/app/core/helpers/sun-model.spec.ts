import table from './sun-model.fixtures.json';
import { AVERAGE_LIGHT, lightAt, sunAngleAt } from './sun-model';
import type { SurfacePoint } from './surface-coords';

interface Fixtures {
  dayMinutes: number;
  holdMinutes: number;
  lightAt: { name: string; point: SurfacePoint; sunAngle: number; expect: number }[];
  sunAngleAt: {
    name: string;
    at: string;
    // The override's at is an ISO timestamp here.
    override: { angle: number; at: string } | null;
    expect: number;
  }[];
}

// The backend spec checks that this table and the helper match its copies.
const fixtures: Fixtures = table;

describe('sun model', () => {
  describe('lightAt', () => {
    it.each(fixtures.lightAt)('$name', ({ point, sunAngle, expect: want }) => {
      expect(lightAt(point, sunAngle)).toBeCloseTo(want, 12);
    });

    it('stays within 0..1 all over the planet', () => {
      for (let lat = -90; lat <= 90; lat += 15) {
        for (let lon = -180; lon <= 180; lon += 15) {
          const light = lightAt({ lat, lon }, 123);

          expect(light).toBeGreaterThanOrEqual(0);
          expect(light).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('sunAngleAt', () => {
    it.each(fixtures.sunAngleAt)('$name', ({ at, override, expect: want }) => {
      const angle = sunAngleAt(
        new Date(at),
        fixtures.dayMinutes,
        override && { angle: override.angle, at: new Date(override.at) },
        fixtures.holdMinutes,
      );

      expect(angle).toBeCloseTo(want, 12);
    });

    it('stays within 0 up to 360', () => {
      const start = Date.parse('2030-01-01T00:00:00.000Z');

      for (let minute = -100; minute < 200; minute += 7.3) {
        const t = new Date(start + minute * 60_000);
        const angle = sunAngleAt(t, fixtures.dayMinutes, null, fixtures.holdMinutes);

        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThan(360);
      }
    });
  });

  it('gives away time an average light of 0.5 (TIM-01 AC4)', () => {
    expect(AVERAGE_LIGHT).toBe(0.5);
  });
});
