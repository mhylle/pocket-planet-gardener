import { IsString, MaxLength } from 'class-validator';

/** Body of POST /api/planet. */
export class CreatePlanetDto {
  // Only bounds the payload. The length and wording rules live in
  // PlanetsService, so their 400 carries a friendly message.
  @IsString()
  @MaxLength(200)
  name!: string;
}
