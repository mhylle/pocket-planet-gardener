import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Planet } from '../planets/planet.entity';
import { TutorialController } from './tutorial.controller';
import { TutorialService } from './tutorial.service';

// The step lives on the planets row but is no gameplay state, so this module
// writes it straight through the Planet repository, not through mutate().
@Module({
  imports: [TypeOrmModule.forFeature([Planet])],
  providers: [TutorialService],
  controllers: [TutorialController],
})
export class TutorialModule {}
