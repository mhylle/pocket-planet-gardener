import { CloudState } from '../helpers/cloud-rules';
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

/**
 * Where the sun is. A sun the player moved stays put for a while; both override fields are null
 * when it moves freely.
 */
export interface SunStateDto {
  /** Degrees: the longitude the sun is over now. */
  angle: number;
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
  /** Each cloud as of serverTime. */
  clouds: CloudState[];
  sun: SunStateDto;
  /** The creatures living here; the snapshot names them from Phase 11 on, so missing means none. */
  creatures?: readonly unknown[];
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

/** The 200 response of POST /api/garden/rain. */
export interface RainResponse extends CommandResponse {
  /** The cloud ran dry, so it rains no more until it has refilled (GRD-02 AC2). */
  cloudEmpty: boolean;
}
