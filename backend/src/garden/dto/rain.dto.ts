import { IsNumber, IsPositive, IsString, Max } from 'class-validator';
import { PositionDto } from './position.dto';

/** Body of POST /api/garden/rain: a cloud held over a spot (GRD-02). */
export class RainDto extends PositionDto {
  @IsString()
  cloudId!: string;

  // The client sends one rain command a second or so while a cloud is held.
  @IsNumber()
  @IsPositive()
  @Max(2)
  seconds!: number;
}
