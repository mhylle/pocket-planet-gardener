import { AVERAGE_LIGHT, lightAt, sunAngleAt } from './sun-model';

const DAY_MINUTES = 60;
const HOLD_MINUTES = 5;
const MINUTE = 60_000;
const START = new Date('2030-01-01T00:00:00.000Z');

function at(minutes: number): Date {
  return new Date(START.getTime() + minutes * MINUTE);
}

describe('sun model', () => {
  describe('lightAt', () => {
    it('is 1 at the point facing the sun', () => {
      expect(lightAt({ lat: 0, lon: 30 }, 30)).toBeCloseTo(1, 12);
    });

    it('is 0 at its antipode', () => {
      expect(lightAt({ lat: 0, lon: -150 }, 30)).toBe(0);
    });

    it('fades with the angle from the sun and is 0 on the night side', () => {
      expect(lightAt({ lat: 0, lon: 90 }, 30)).toBeCloseTo(0.5, 12);
      expect(lightAt({ lat: 60, lon: 30 }, 30)).toBeCloseTo(0.5, 12);
      expect(lightAt({ lat: 90, lon: 0 }, 30)).toBeCloseTo(0, 12);
      expect(lightAt({ lat: 0, lon: 150 }, 30)).toBe(0);
    });

    it('takes sun angles from 0 up to 360 like longitudes', () => {
      expect(lightAt({ lat: 0, lon: -90 }, 270)).toBeCloseTo(1, 12);
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
    it('drifts once round the planet per sun day, counted from the epoch', () => {
      expect(sunAngleAt(new Date(0), DAY_MINUTES, null, HOLD_MINUTES)).toBe(0);
      expect(sunAngleAt(at(15), DAY_MINUTES, null, HOLD_MINUTES)).toBe(90);
      expect(sunAngleAt(at(90), DAY_MINUTES, null, HOLD_MINUTES)).toBe(180);
      expect(sunAngleAt(at(60), 240, null, HOLD_MINUTES)).toBe(90);
    });

    it('stays within 0 up to 360', () => {
      for (let minute = -100; minute < 200; minute += 7.3) {
        const angle = sunAngleAt(at(minute), DAY_MINUTES, null, HOLD_MINUTES);

        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThan(360);
      }
    });

    it('holds a dragged sun where it was left for the hold time', () => {
      const override = { angle: -90, at: at(7) };

      for (const minute of [7, 8, 11.99, 12]) {
        expect(
          sunAngleAt(at(minute), DAY_MINUTES, override, HOLD_MINUTES),
        ).toBe(270);
      }
    });

    it('drifts on from the dragged angle after the hold time (GRD-03 AC2)', () => {
      const override = { angle: 100, at: at(7) };

      expect(sunAngleAt(at(27), DAY_MINUTES, override, HOLD_MINUTES)).toBe(190);
      expect(sunAngleAt(at(72), DAY_MINUTES, override, HOLD_MINUTES)).toBe(100);
    });

    it('resumes without a jump at the end of the hold', () => {
      const override = { angle: 200, at: at(7) };
      const before = sunAngleAt(at(12), DAY_MINUTES, override, HOLD_MINUTES);
      const after = sunAngleAt(
        new Date(at(12).getTime() + 1),
        DAY_MINUTES,
        override,
        HOLD_MINUTES,
      );

      expect(before).toBe(200);
      // One millisecond of a 60-minute day.
      expect(after - before).toBeCloseTo(360 / (DAY_MINUTES * MINUTE), 12);
    });
  });

  it('gives away time an average light of 0.5 (TIM-01 AC4)', () => {
    expect(AVERAGE_LIGHT).toBe(0.5);
  });
});
