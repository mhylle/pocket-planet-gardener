import { IsIn } from 'class-validator';
import type { DecorationId } from '../../content/content.types';
import { DECORATIONS } from '../../content/decorations';
import { PositionDto } from './position.dto';

/** Body of POST /api/garden/decorations. */
export class PlaceDecorationDto extends PositionDto {
  @IsIn(DECORATIONS.map((decoration) => decoration.id))
  itemType!: DecorationId;
}
