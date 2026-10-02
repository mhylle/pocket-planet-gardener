import { IsInt, Min } from 'class-validator';

/** Body of every garden command: the version the client last saw (D-2). */
export class GardenCommandDto {
  // Versions start at 1.
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
