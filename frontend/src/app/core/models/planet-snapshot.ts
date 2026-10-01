import { PlanetDto } from './planet';

export type PlantStage = 'seed' | 'sprout' | 'young' | 'bloom';

export interface PlantDto {
  id: string;
  type: string;
  lat: number;
  lon: number;
  stage: PlantStage;
  growth: number;
  water: number;
  /** ISO timestamp. */
  plantedAt: string;
  harvestReady: boolean;
}

export interface DecorationDto {
  id: string;
  type: string;
  lat: number;
  lon: number;
}

export interface InventoryItemDto {
  itemType: string;
  kind: 'seed' | 'decoration';
  count: number;
}

/** A sun the player moved stays put for a while; both fields are null when it moves freely. */
export interface SunStateDto {
  overrideAngle: number | null;
  /** ISO timestamp. */
  overrideAt: string | null;
}

/** The whole planet as served by GET /api/planet and returned by every command and sync. */
export interface PlanetSnapshotDto extends PlanetDto {
  radiusLevel: number;
  maxPlants: number;
  tutorialStep: number;
  /** ISO timestamp of the server clock when the snapshot was taken. */
  serverTime: string;
  plants: PlantDto[];
  decorations: DecorationDto[];
  inventory: InventoryItemDto[];
  unlocks: string[];
  clouds: unknown[];
  sun: SunStateDto;
}

/** Something that happened on the planet, such as a creature arriving. */
export interface EventDto {
  type: string;
  /** ISO timestamp. */
  occurredAt: string;
  payload: Record<string, unknown>;
}

/** The 200 response of POST /api/planet/sync. */
export interface SyncResponse {
  snapshot: PlanetSnapshotDto;
  events: EventDto[];
}

/** The 200 response of every gameplay command. */
export interface CommandResponse extends SyncResponse {
  newlyUnlocked?: string[];
}
