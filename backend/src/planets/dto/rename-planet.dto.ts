import { IsString, MaxLength } from 'class-validator';

/** Body of PATCH /api/planet/name. */
export class RenamePlanetDto {
  // Only bounds the payload. The length and wording rules live in
  // PlanetsService, so their 400 carries a friendly message.
  @IsString()
  @MaxLength(200)
  name!: string;
}
