import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TUTORIAL_STEPS } from '../content/tutorial';
import { Planet } from '../planets/planet.entity';
import type { TutorialDto, TutorialProgressDto } from './dto/tutorial.dto';
import { canMoveTo } from './tutorial-rules';

/** Pip's tutorial (ONB-01): the script, and the step each planet has reached. */
@Injectable()
export class TutorialService {
  constructor(
    @InjectRepository(Planet) private readonly planets: Repository<Planet>,
  ) {}

  tutorial(): TutorialDto {
    return { steps: TUTORIAL_STEPS };
  }

  /**
   * Keeps the step the player has reached, so a reload continues there
   * (ONB-01 AC4), when canMoveTo allows it; otherwise a 400. Progress is not
   * gameplay, so this is no command and leaves the version alone. The row
   * is locked, so two tabs cannot move the step backwards between them.
   */
  setStep(planetId: string, step: number): Promise<TutorialProgressDto> {
    return this.planets.manager.transaction(async (em) => {
      const planet = await em.findOne(Planet, {
        where: { id: planetId },
        lock: { mode: 'for_no_key_update' },
      });
      if (!planet) {
        throw new NotFoundException('This planet has drifted away');
      }
      if (!canMoveTo(planet.tutorialStep, step, TUTORIAL_STEPS.length - 1)) {
        throw new BadRequestException("Pip can't go to that step from here.");
      }
      await em.update(Planet, { id: planetId }, { tutorialStep: step });
      return { tutorialStep: step };
    });
  }
}
