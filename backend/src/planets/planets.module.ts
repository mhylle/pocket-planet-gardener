import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanetGuard } from './planet-context/planet.guard';
import { Planet } from './planet.entity';
import { PlanetsController } from './planets.controller';
import { PlanetsService } from './planets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Planet])],
  providers: [
    PlanetsService,
    // Registered here, not in AppModule, because it needs the Planet repository.
    { provide: APP_GUARD, useClass: PlanetGuard },
  ],
  controllers: [PlanetsController],
  exports: [TypeOrmModule],
})
export class PlanetsModule {}
