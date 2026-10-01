import { Controller, Get } from '@nestjs/common';
import { NoPlanet } from '../planets/planet-context/no-planet.decorator';
import type { PublicGameConfigDto } from './dto/public-game-config.dto';
import { GameConfigService } from './game-config.service';

@NoPlanet()
@Controller('config')
export class GameConfigController {
  constructor(private readonly gameConfig: GameConfigService) {}

  /** The tunables the client needs. Not planet-scoped. */
  @Get()
  get(): PublicGameConfigDto {
    return this.gameConfig.publicConfig();
  }
}
