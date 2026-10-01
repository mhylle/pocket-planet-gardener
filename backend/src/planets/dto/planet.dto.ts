import type { Planet } from '../planet.entity';

/** The planet's identity fields. The routes serve the snapshot, which starts with them. */
export interface PlanetDto {
  id: string;
  // Typed on another device to open this planet (ACC-04).
  code: string;
  name: string;
  version: number;
  // ISO timestamp.
  createdAt: string;
}

/** Picks the public fields by name, so a new column stays private until listed here. */
export function toPlanetDto(planet: Planet): PlanetDto {
  return {
    id: planet.id,
    code: planet.code,
    name: planet.name,
    version: planet.version,
    createdAt: planet.createdAt.toISOString(),
  };
}
