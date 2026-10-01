import type { Decoration } from '../../garden/decoration.entity';
import type { Plant } from '../../garden/plant.entity';
import type { InventoryItem } from '../../inventory/inventory-item.entity';
import type { Unlock } from '../../inventory/unlock.entity';
import { toPlanetDto } from '../dto/planet.dto';
import type {
  DecorationDto,
  EventDto,
  InventoryItemDto,
  PlanetSnapshotDto,
  PlantDto,
  SunStateDto,
} from '../dto/planet-snapshot.dto';
import type { Planet } from '../planet.entity';
import type { Fact } from './mutation.types';

// Every mapper picks the public fields by name, so a new column stays
// private until it is listed here.

/** The planet's child rows, already in snapshot order. */
export interface SnapshotRows {
  plants: Plant[];
  decorations: Decoration[];
  inventory: InventoryItem[];
  unlocks: Unlock[];
}

export function toPlantDto(plant: Plant): PlantDto {
  return {
    id: plant.id,
    type: plant.type,
    lat: plant.lat,
    lon: plant.lon,
    stage: plant.stage,
    growth: plant.growth,
    water: plant.water,
    plantedAt: plant.plantedAt.toISOString(),
    harvestReady: plant.harvestReady,
  };
}

export function toDecorationDto(decoration: Decoration): DecorationDto {
  return {
    id: decoration.id,
    type: decoration.type,
    lat: decoration.lat,
    lon: decoration.lon,
  };
}

export function toInventoryItemDto(item: InventoryItem): InventoryItemDto {
  return { itemType: item.itemType, kind: item.kind, count: item.count };
}

export function toSunStateDto(planet: Planet): SunStateDto {
  return {
    overrideAngle: planet.sunOverrideAngle,
    overrideAt: planet.sunOverrideAt?.toISOString() ?? null,
  };
}

export function toEventDto(fact: Fact): EventDto {
  return {
    type: fact.type,
    occurredAt: fact.occurredAt.toISOString(),
    payload: fact.payload,
  };
}

/** The snapshot before any contributor has added to it. */
export function toPlanetSnapshot(
  planet: Planet,
  rows: SnapshotRows,
  serverTime: Date,
): PlanetSnapshotDto {
  return {
    // Already picked by name, and keeps the snapshot a superset of PlanetDto.
    ...toPlanetDto(planet),
    radiusLevel: planet.radiusLevel,
    maxPlants: planet.maxPlants,
    tutorialStep: planet.tutorialStep,
    serverTime: serverTime.toISOString(),
    plants: rows.plants.map(toPlantDto),
    decorations: rows.decorations.map(toDecorationDto),
    inventory: rows.inventory.map(toInventoryItemDto),
    unlocks: rows.unlocks.map((unlock) => unlock.itemType),
    clouds: planet.clouds,
    sun: toSunStateDto(planet),
  };
}
