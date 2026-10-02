import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentPlanet } from '../planets/planet-context/current-planet.decorator';
import type { MutationResult } from '../planets/planet-state/mutation.types';
import { MaybeLaterDto } from './dto/maybe-later.dto';
import { WantsService } from './wants.service';

/** The want commands; each answers { snapshot, events, newlyUnlocked }. */
@Controller('wants')
export class WantsController {
  constructor(private readonly wants: WantsService) {}

  // Puts a want off and creates nothing, so 200 (WNT-05).
  @Post(':id/maybe-later')
  @HttpCode(200)
  maybeLater(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MaybeLaterDto,
  ): Promise<MutationResult> {
    return this.wants.maybeLater(planetId, id, body.expectedVersion);
  }
}
