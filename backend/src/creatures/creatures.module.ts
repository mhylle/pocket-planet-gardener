import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { PlanetsModule } from '../planets/planets.module';
import { Creature } from './creature.entity';
import { CreaturesService } from './creatures.service';
import { IdentityService } from './identity.service';

// Imports PlanetsModule to register its evaluator and snapshot contributor
// with PlanetStateService, and AiModule for the gateway the identities come
// through; neither imports this one.
@Module({
  imports: [TypeOrmModule.forFeature([Creature]), PlanetsModule, AiModule],
  providers: [CreaturesService, IdentityService],
})
export class CreaturesModule {}
