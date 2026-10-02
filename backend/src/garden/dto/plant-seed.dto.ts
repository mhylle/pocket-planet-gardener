import { IsIn } from 'class-validator';
import type { PlantId } from '../../content/content.types';
import { PLANTS } from '../../content/plants';
import { PositionDto } from './position.dto';

/** Body of POST /api/garden/plants. */
export class PlantSeedDto extends PositionDto {
  @IsIn(PLANTS.map((plant) => plant.id))
  itemType!: PlantId;
}
