import { PlantDto, PlantStage } from '../models/planet-snapshot';
import { WaterStatus, waterStatus } from './growth-rules';

/** How a plant shows on the planet. */
export interface PlantPresentation {
  stage: PlantStage;
  /** Thirsty: it droops and stops growing until it is watered (GRD-04 AC3). */
  droop: boolean;
  /** In bloom with seeds ready to harvest (GRD-08 AC1). */
  sparkle: boolean;
  water: WaterStatus;
}

/** How the plant in the snapshot shows; the server decides its stage. */
export function presentPlant(plant: PlantDto): PlantPresentation {
  const water = waterStatus(plant.water);
  return {
    stage: plant.stage,
    droop: water === 'thirsty',
    sparkle: plant.stage === 'bloom' && plant.harvestReady,
    water,
  };
}
