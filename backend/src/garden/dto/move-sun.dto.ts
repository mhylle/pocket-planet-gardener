import { IsNumber, Max, Min, NotEquals } from 'class-validator';
import { GardenCommandDto } from './garden-command.dto';

/** Body of POST /api/garden/sun: where the sun was dragged to (GRD-03). */
export class MoveSunDto extends GardenCommandDto {
  // The longitude the sun stands over, from 0 up to but not including 360.
  @IsNumber()
  @Min(0)
  @Max(360)
  @NotEquals(360)
  angle!: number;
}
