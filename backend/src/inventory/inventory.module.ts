import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Unlock } from './unlock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, Unlock])],
  exports: [TypeOrmModule],
})
export class InventoryModule {}
