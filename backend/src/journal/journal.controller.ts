import { Controller, Get, Query } from '@nestjs/common';
import { CurrentPlanet } from '../planets/planet-context/current-planet.decorator';
import type { JournalPageDto } from './dto/journal-entry.dto';
import { JournalQueryDto } from './dto/journal-query.dto';
import { JournalService } from './journal.service';

/** The journal book (JRN-03). Entries are written by syncs, never through a route. */
@Controller('journal')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get()
  list(
    @CurrentPlanet() planetId: string,
    @Query() query: JournalQueryDto,
  ): Promise<JournalPageDto> {
    return this.journal.list(planetId, query.before, query.limit);
  }
}
