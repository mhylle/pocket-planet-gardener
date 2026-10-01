import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePlanetDto } from './dto/create-planet.dto';
import { DeletePlanetDto } from './dto/delete-planet.dto';
import type { PlanetDto } from './dto/planet.dto';
import { RenamePlanetDto } from './dto/rename-planet.dto';
import { CurrentPlanet } from './planet-context/current-planet.decorator';
import { NoPlanet } from './planet-context/no-planet.decorator';
import { PlanetsService } from './planets.service';

@Controller('planet')
export class PlanetsController {
  constructor(private readonly planetsService: PlanetsService) {}

  /** Creates a planet. Not planet-scoped: the caller has none yet. */
  @NoPlanet()
  @Post()
  create(@Body() body: CreatePlanetDto): Promise<PlanetDto> {
    return this.planetsService.create(body.name);
  }

  @Get()
  get(@CurrentPlanet() planetId: string): Promise<PlanetDto> {
    return this.planetsService.get(planetId);
  }

  @Patch('name')
  rename(
    @CurrentPlanet() planetId: string,
    @Body() body: RenamePlanetDto,
  ): Promise<PlanetDto> {
    return this.planetsService.rename(planetId, body.name);
  }

  /** The id of the planet with this code, to open it on another device. */
  @NoPlanet()
  @Get('by-code/:code')
  findByCode(@Param('code') code: string): Promise<{ id: string }> {
    return this.planetsService.findIdByCode(code);
  }

  // The body is declared only so the ValidationPipe checks the confirmation.
  @Delete()
  @HttpCode(204)
  delete(
    @Body() _confirmation: DeletePlanetDto,
    @CurrentPlanet() planetId: string,
  ): Promise<void> {
    return this.planetsService.delete(planetId);
  }
}
