import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanetsModule } from '../planets/planets.module';
import { PlanetEvent } from './event.entity';
import { EventLogService } from './event-log.service';
import { ReturnService } from './return.service';

// Imports PlanetsModule to register its fact sink and sync contributor with
// PlanetStateService; PlanetsModule never imports this one.
@Module({
  imports: [TypeOrmModule.forFeature([PlanetEvent]), PlanetsModule],
  providers: [EventLogService, ReturnService],
})
export class EventsModule {}
