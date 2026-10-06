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
import type { PlanetSnapshotDto } from './dto/planet-snapshot.dto';
import { RenamePlanetDto } from './dto/rename-planet.dto';
import { SyncPlanetDto } from './dto/sync-planet.dto';
import { UpdatePlayerSettingsDto } from './dto/update-player-settings.dto';
import { CurrentPlanet } from './planet-context/current-planet.decorator';
import { NoPlanet } from './planet-context/no-planet.decorator';
import {
  PlanetStateService,
  type SyncResult,
} from './planet-state/planet-state.service';
import { PlanetsService } from './planets.service';
import { PlayerSettingsService } from './player-settings.service';
import type { PlayerSettings } from './settings-rules';

@Controller('planet')
export class PlanetsController {
  constructor(
    private readonly planetsService: PlanetsService,
    private readonly planetState: PlanetStateService,
    private readonly playerSettings: PlayerSettingsService,
  ) {}

  /** Creates a planet. Not planet-scoped: the caller has none yet. */
  @NoPlanet()
  @Post()
  create(@Body() body: CreatePlanetDto): Promise<PlanetSnapshotDto> {
    return this.planetsService.create(body.name);
  }

  @Get()
  get(@CurrentPlanet() planetId: string): Promise<PlanetSnapshotDto> {
    return this.planetsService.get(planetId);
  }

  @Patch('name')
  rename(
    @CurrentPlanet() planetId: string,
    @Body() body: RenamePlanetDto,
  ): Promise<PlanetSnapshotDto> {
    return this.planetsService.rename(planetId, body.name);
  }

  @Get('settings')
  getSettings(@CurrentPlanet() planetId: string): Promise<PlayerSettings> {
    return this.playerSettings.get(planetId);
  }

  /** Not a command: no expectedVersion, and the version stays as it is. */
  @Patch('settings')
  updateSettings(
    @CurrentPlanet() planetId: string,
    @Body() body: UpdatePlayerSettingsDto,
  ): Promise<PlayerSettings> {
    return this.playerSettings.update(planetId, body);
  }

  /** The heartbeat (D-3). A 200, not a 201: it creates nothing. */
  @Post('sync')
  @HttpCode(200)
  sync(
    @CurrentPlanet() planetId: string,
    @Body() body: SyncPlanetDto,
  ): Promise<SyncResult> {
    return this.planetState.sync(planetId, body.expectedVersion);
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
