import type { DecorationId, PlantId } from '../../content/content.types';
import type { PlantStage } from '../../garden/plant.entity';
import type { ItemKind } from '../../inventory/inventory-item.entity';
import type { PlanetDto } from './planet.dto';

/** A plant as the client draws it. */
export interface PlantDto {
  id: string;
  type: PlantId;
  // Surface position in degrees.
  lat: number;
  lon: number;
  stage: PlantStage;
  // Progress towards bloom, 0..1.
  growth: number;
  // 0..1.
  water: number;
  // ISO timestamp.
  plantedAt: string;
  harvestReady: boolean;
}

/** A placed decoration as the client draws it. */
export interface DecorationDto {
  id: string;
  type: DecorationId;
  lat: number;
  lon: number;
}

/** One inventory stack; only stacks the planet still holds are served. */
export interface InventoryItemDto {
  itemType: PlantId | DecorationId;
  kind: ItemKind;
  count: number;
}

/** Where the player last dragged the sun, and when; both null while it drifts. */
export interface SunStateDto {
  overrideAngle: number | null;
  // ISO timestamp.
  overrideAt: string | null;
  // The longitude the sun stands over at serverTime, 0 up to 360 degrees.
  // Added by SimulationModule's snapshot contributor.
  angle?: number;
}

/**
 * The whole planet, as served by GET /api/planet and returned by every
 * command and sync (D-2, D-3). A superset of PlanetDto, so clients written
 * against PlanetDto keep working.
 */
export interface PlanetSnapshotDto extends PlanetDto {
  radiusLevel: number;
  maxPlants: number;
  tutorialStep: number;
  // ISO timestamp of the server clock when the snapshot was taken.
  serverTime: string;
  // Oldest first, then by id.
  plants: PlantDto[];
  // Oldest first, then by id.
  decorations: DecorationDto[];
  // By item type.
  inventory: InventoryItemDto[];
  // Unlocked item types, sorted.
  unlocks: string[];
  clouds: unknown[];
  sun: SunStateDto;
}

/** Something that happened on the planet, such as a plant blooming. */
export interface EventDto {
  type: string;
  // ISO timestamp.
  occurredAt: string;
  payload: Record<string, unknown>;
}
