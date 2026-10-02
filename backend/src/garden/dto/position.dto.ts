import { IsNumber, Max, Min } from 'class-validator';
import { GardenCommandDto } from './garden-command.dto';

/** A garden command aimed at a spot on the surface, in degrees. */
export class PositionDto extends GardenCommandDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;
}
