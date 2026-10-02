import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './inventory-item.entity';
import { InventoryService } from './inventory.service';
import { Unlock } from './unlock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, Unlock])],
  providers: [InventoryService],
  exports: [TypeOrmModule, InventoryService],
})
export class InventoryModule {}
