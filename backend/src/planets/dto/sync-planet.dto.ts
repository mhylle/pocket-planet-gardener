import { IsInt, Min } from 'class-validator';

/** Body of POST /api/planet/sync: the version the client last saw. */
export class SyncPlanetDto {
  // Versions start at 1.
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
