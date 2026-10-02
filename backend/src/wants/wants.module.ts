import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { CreatureMemory } from '../creatures/creature-memory.entity';
import { CreaturesModule } from '../creatures/creatures.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PlanetsModule } from '../planets/planets.module';
import { RewardService } from './reward.service';
import { WantGenerationService } from './want-generation.service';
import { Want } from './want.entity';
import { WantsController } from './wants.controller';
import { WantsService } from './wants.service';

// Imports PlanetsModule to register its hooks with PlanetStateService,
// AiModule for the gateway, InventoryModule for the rewards, and
// CreaturesModule, which exports nothing, only so that Nest initialises it
// first: its arrivals and creatures slice must come before the wants'.
@Module({
  imports: [
    TypeOrmModule.forFeature([Want, CreatureMemory]),
    PlanetsModule,
    AiModule,
    InventoryModule,
    CreaturesModule,
  ],
  providers: [WantsService, WantGenerationService, RewardService],
  controllers: [WantsController],
  exports: [TypeOrmModule],
})
export class WantsModule {}
