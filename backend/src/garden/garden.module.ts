import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Decoration } from './decoration.entity';
import { Plant } from './plant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Plant, Decoration])],
  exports: [TypeOrmModule],
})
export class GardenModule {}
