import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Decoration } from '../garden/decoration.entity';
import { Plant } from '../garden/plant.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { Unlock } from '../inventory/unlock.entity';
import { PlanetGuard } from './planet-context/planet.guard';
import { PlanetStateService } from './planet-state/planet-state.service';
import { Planet } from './planet.entity';
import { PlanetsController } from './planets.controller';
import { PlanetsService } from './planets.service';

@Module({
  // The child entities are listed because the snapshot reads them, so this
  // module need not import GardenModule or InventoryModule (which will
  // import this one for mutate()).
  imports: [
    TypeOrmModule.forFeature([
      Planet,
      Plant,
      Decoration,
      InventoryItem,
      Unlock,
    ]),
  ],
  providers: [
    PlanetsService,
    PlanetStateService,
    // Registered here, not in AppModule, because it needs the Planet repository.
    { provide: APP_GUARD, useClass: PlanetGuard },
  ],
  controllers: [PlanetsController],
  exports: [TypeOrmModule, PlanetStateService],
})
export class PlanetsModule {}
