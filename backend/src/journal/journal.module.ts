import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { EventsModule } from '../events/events.module';
import { PlanetsModule } from '../planets/planets.module';
import { JournalEntry } from './journal-entry.entity';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

// EventsModule gives the event log and ReturnService, which the writer is
// registered with; PlanetsModule the snapshot the prompt describes; AiModule
// the gateway. None of them imports this one.
@Module({
  imports: [
    TypeOrmModule.forFeature([JournalEntry]),
    PlanetsModule,
    EventsModule,
    AiModule,
  ],
  providers: [JournalService],
  controllers: [JournalController],
})
export class JournalModule {}
