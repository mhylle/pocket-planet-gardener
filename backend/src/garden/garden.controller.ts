import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { MutationResult } from '../planets/planet-state/mutation.types';
import { CurrentPlanet } from '../planets/planet-context/current-planet.decorator';
import { GardenCommandDto } from './dto/garden-command.dto';
import { MoveSunDto } from './dto/move-sun.dto';
import { PlaceDecorationDto } from './dto/place-decoration.dto';
import { PlantSeedDto } from './dto/plant-seed.dto';
import { PositionDto } from './dto/position.dto';
import { RainDto } from './dto/rain.dto';
import { GardenService, type RainResult } from './garden.service';

/**
 * The garden commands; each answers { snapshot, events, newlyUnlocked }, and
 * rain adds cloudEmpty.
 */
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

  // Like the sky commands, a harvest creates nothing, so 200.
  @Post('plants/:id/harvest')
  @HttpCode(200)
  harvest(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GardenCommandDto,
  ): Promise<MutationResult> {
    return this.garden.harvest(planetId, id, body);
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

  // The sky commands create nothing, so they answer 200 like a sync.
  @Post('rain')
  @HttpCode(200)
  rain(
    @CurrentPlanet() planetId: string,
    @Body() body: RainDto,
  ): Promise<RainResult> {
    return this.garden.rain(planetId, body);
  }

  @Post('clouds/:id/position')
  @HttpCode(200)
  moveCloud(
    @CurrentPlanet() planetId: string,
    @Param('id') id: string,
    @Body() body: PositionDto,
  ): Promise<MutationResult> {
    return this.garden.moveCloud(planetId, id, body);
  }

  @Post('sun')
  @HttpCode(200)
  moveSun(
    @CurrentPlanet() planetId: string,
    @Body() body: MoveSunDto,
  ): Promise<MutationResult> {
    return this.garden.moveSun(planetId, body);
  }
}
