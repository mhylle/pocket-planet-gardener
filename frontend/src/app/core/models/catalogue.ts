/** A plant type as served by GET /api/catalogue. */
export interface CataloguePlant {
  id: string;
  name: string;
  waterPref: 'low' | 'medium' | 'high';
  lightPref: 'shade' | 'partial' | 'full-sun';
  bloomMinutes: number;
  description: string;
  unlockHint: string;
}

/** A decoration type as served by GET /api/catalogue. */
export interface CatalogueDecoration {
  id: string;
  name: string;
  /** Steps across on the surface. */
  footprintSteps: number;
  /** Water, such as the pond: nothing can be placed on it. */
  isWater: boolean;
  description: string;
  unlockHint: string;
}

/** A creature species as served by GET /api/catalogue: the hint, never how it arrives. */
export interface CatalogueSpecies {
  id: string;
  name: string;
  hint: string;
}

/** The public game content served by GET /api/catalogue. */
export interface CatalogueDto {
  plants: CataloguePlant[];
  decorations: CatalogueDecoration[];
  species: CatalogueSpecies[];
}
