import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { MutationResult } from '../planets/planet-state/mutation.types';
import { CurrentPlanet } from '../planets/planet-context/current-planet.decorator';
import { GardenCommandDto } from './dto/garden-command.dto';
import { PlaceDecorationDto } from './dto/place-decoration.dto';
import { PlantSeedDto } from './dto/plant-seed.dto';
import { PositionDto } from './dto/position.dto';
import { GardenService } from './garden.service';

/** The garden commands; each answers { snapshot, events, newlyUnlocked }. */
@Controller('garden')
export class GardenController {
  constructor(private readonly garden: GardenService) {}

  @Post('plants')
  plant(
    @CurrentPlanet() planetId: string,
    @Body() body: PlantSeedDto,
  ): Promise<MutationResult> {
    return this.garden.plant(planetId, body);
  }

  @Delete('plants/:id')
  digUp(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GardenCommandDto,
  ): Promise<MutationResult> {
    return this.garden.digUp(planetId, id, body);
  }

  @Post('decorations')
  placeDecoration(
    @CurrentPlanet() planetId: string,
    @Body() body: PlaceDecorationDto,
  ): Promise<MutationResult> {
    return this.garden.placeDecoration(planetId, body);
  }

  @Patch('decorations/:id/position')
  moveDecoration(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PositionDto,
  ): Promise<MutationResult> {
    return this.garden.moveDecoration(planetId, id, body);
  }

  @Delete('decorations/:id')
  putAwayDecoration(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GardenCommandDto,
  ): Promise<MutationResult> {
    return this.garden.putAwayDecoration(planetId, id, body);
  }
}
