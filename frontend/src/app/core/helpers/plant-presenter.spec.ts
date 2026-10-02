import { PlantStage } from '../models/planet-snapshot';
import { plantAt } from '../../testing/garden-fixtures';
import { presentPlant } from './plant-presenter';

describe('presentPlant', () => {
  it('droops a thirsty plant (GRD-04 AC3), and only a thirsty one', () => {
    expect(presentPlant(plantAt('p', 0, 0, { water: 0.05 }))).toMatchObject({
      droop: true,
      water: 'thirsty',
    });
    expect(presentPlant(plantAt('p', 0, 0, { water: 0 })).droop).toBe(true);
    for (const [water, status] of [
      [0.2, 'a-bit-thirsty'],
      [0.6, 'happy'],
      [0.95, 'soggy'],
    ] as const) {
      expect(presentPlant(plantAt('p', 0, 0, { water }))).toMatchObject({
        droop: false,
        water: status,
      });
    }
  });

  it('sparkles over a bloom with seeds ready (GRD-08 AC1)', () => {
    const ready = plantAt('p', 0, 0, { stage: 'bloom', harvestReady: true });
    const harvested = plantAt('p', 0, 0, { stage: 'bloom', harvestReady: false });

    expect(presentPlant(ready).sparkle).toBe(true);
    expect(presentPlant(harvested).sparkle).toBe(false);
  });

  it('never sparkles before bloom', () => {
    for (const stage of ['seed', 'sprout', 'young'] as PlantStage[]) {
      expect(presentPlant(plantAt('p', 0, 0, { stage, harvestReady: true })).sparkle).toBe(false);
    }
  });

  it("shows the server's stage, also on a drooping plant", () => {
    const thirsty = plantAt('p', 0, 0, { stage: 'young', growth: 0.7, water: 0 });

    expect(presentPlant(thirsty)).toEqual({
      stage: 'young',
      droop: true,
      sparkle: false,
      water: 'thirsty',
    });
  });
});
