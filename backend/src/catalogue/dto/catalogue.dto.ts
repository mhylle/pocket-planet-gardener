import type {
  DecorationId,
  LightPref,
  PlantId,
  SpeciesId,
  WaterPref,
} from '../../content/content.types';

/** A plant type as the catalogue shows it (ITM-03, GRD-05 AC2). */
export interface PublicPlant {
  id: PlantId;
  name: string;
  waterPref: WaterPref;
  lightPref: LightPref;
  bloomMinutes: number;
  description: string;
  unlockHint: string;
}

/** A decoration type as the catalogue shows it (ITM-03). */
export interface PublicDecoration {
  id: DecorationId;
  name: string;
  // Steps across.
  footprintSteps: number;
  // Water refuses plants, so the client previews it like the server (GRD-01 AC3).
  isWater: boolean;
  description: string;
  unlockHint: string;
}

/** A species as the catalogue shows it: the hint, never the arrival condition (CRT-01 AC2). */
export interface PublicSpecies {
  id: SpeciesId;
  name: string;
  hint: string;
}

/** The public content served by GET /api/catalogue. */
export interface CatalogueDto {
  plants: PublicPlant[];
  decorations: PublicDecoration[];
  species: PublicSpecies[];
}
