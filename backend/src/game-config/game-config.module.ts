import { Global, Module } from '@nestjs/common';
import { GameConfigController } from './game-config.controller';
import { GameConfigService } from './game-config.service';

// Global so every feature module can inject GameConfigService without
// importing this module.
@Global()
@Module({
  providers: [GameConfigService],
  controllers: [GameConfigController],
  exports: [GameConfigService],
})
export class GameConfigModule {}
