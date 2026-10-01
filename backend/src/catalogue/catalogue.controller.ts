import { Controller, Get } from '@nestjs/common';
import { NoPlanet } from '../planets/planet-context/no-planet.decorator';
import { CatalogueService } from './catalogue.service';
import type { CatalogueDto } from './dto/catalogue.dto';

@NoPlanet()
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  /** Plants, decorations and species in their public shape. Not planet-scoped. */
  @Get()
  get(): CatalogueDto {
    return this.catalogueService.catalogue();
  }
}
