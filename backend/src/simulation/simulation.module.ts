import { Module } from '@nestjs/common';
import { PlanetsModule } from '../planets/planets.module';
import { SimulationService } from './simulation.service';

// Imports PlanetsModule to register its step and contributor with
// PlanetStateService; PlanetsModule never imports this one.
@Module({
  imports: [PlanetsModule],
  providers: [SimulationService],
})
export class SimulationModule {}
