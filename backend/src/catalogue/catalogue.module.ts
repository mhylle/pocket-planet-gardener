import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';

@Module({
  providers: [CatalogueService],
  controllers: [CatalogueController],
})
export class CatalogueModule {}
