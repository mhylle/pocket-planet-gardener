import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { PlanetsModule } from '../planets/planets.module';
import { Decoration } from './decoration.entity';
import { GardenController } from './garden.controller';
import { GardenService } from './garden.service';
import { Plant } from './plant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plant, Decoration]),
    PlanetsModule,
    InventoryModule,
  ],
  providers: [GardenService],
  controllers: [GardenController],
  exports: [TypeOrmModule],
})
export class GardenModule {}
