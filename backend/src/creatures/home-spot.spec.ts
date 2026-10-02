import {
  canPlaceAt,
  type PlacedDecoration,
  type PlacementState,
} from '../simulation/placement-rules';
import { stepsBetween, type SurfacePoint } from '../simulation/surface-coords';
import { chooseHomeSpot } from './home-spot';

const POND: PlacedDecoration = {
  id: 'pond-1',
  lat: 0,
  lon: 20,
  footprintSteps: 3,
  isWater: true,
};

function state(
  plants: SurfacePoint[] = [],
  decorations: PlacedDecoration[] = [POND],
): PlacementState {
  return {
    plants: plants.map((point, i) => ({ id: `plant-${i}`, ...point })),
    decorations,
    maxPlants: 60,
  };
}

function fits(planet: PlacementState, point: SurfacePoint): boolean {
  return (
    canPlaceAt(planet, { kind: 'decoration', point, footprintSteps: 1 }) ===
    'ok'
  );
}

describe('chooseHomeSpot', () => {
  it('settles right beside the pond that drew the creature, clear of the water', () => {
    const spot = chooseHomeSpot(state(), [], [POND]);

    // The pond reaches 1.5 steps and the home half a step, so the first ring
    // clear of it is 2.5 steps out; north comes first.
    expect(spot.lat).toBeCloseTo(12.5, 6);
    expect(spot.lon).toBeCloseTo(20, 6);
    expect(stepsBetween(spot, POND)).toBeCloseTo(2.5, 6);
    expect(fits(state(), spot)).toBe(true);
  });

  it('passes over spots taken by plants and by other creatures', () => {
    // A plant north of the pond, a creature's home east of it.
    const planet = state([{ lat: 12.5, lon: 20 }]);
    const homes = [{ lat: 0, lon: 32.5 }];

    const spot = chooseHomeSpot(planet, homes, [POND]);

    expect(fits(planet, spot)).toBe(true);
    expect(stepsBetween(spot, homes[0])).toBeGreaterThanOrEqual(1);
    expect(stepsBetween(spot, POND)).toBeCloseTo(2.5, 6);
  });

  it('tries the next anchor when the first is boxed in', () => {
    // Reaches 7 steps from its centre, past the outermost ring.
    const boxed: PlacedDecoration = {
      id: 'house',
      lat: 50,
      lon: 0,
      footprintSteps: 14,
      isWater: false,
    };
    const planet = state([], [boxed, POND]);

    const spot = chooseHomeSpot(planet, [], [{ lat: 50, lon: 0 }, POND]);

    expect(stepsBetween(spot, POND)).toBeCloseTo(2.5, 6);
  });

  it('finds a free spot anywhere when nothing drew the creature to one place', () => {
    const planet = state([{ lat: 0, lon: -180 }]);

    const spot = chooseHomeSpot(planet, [], []);

    expect(fits(planet, spot)).toBe(true);
    expect(spot).toEqual({ lat: 0, lon: -165 });
  });

  it('keeps longitudes within -180..180 across the date line', () => {
    const anchor = { lat: 0, lon: 179 };

    const spot = chooseHomeSpot(state([], []), [], [anchor]);

    expect(spot.lon).toBeGreaterThanOrEqual(-180);
    expect(spot.lon).toBeLessThanOrEqual(180);
    expect(stepsBetween(spot, anchor)).toBeCloseTo(1.5, 6);
  });
});
