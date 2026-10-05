import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentPlanet } from '../planets/planet-context/current-planet.decorator';
import { NoPlanet } from '../planets/planet-context/no-planet.decorator';
import { SetTutorialStepDto } from './dto/set-tutorial-step.dto';
import type { TutorialDto, TutorialProgressDto } from './dto/tutorial.dto';
import { TutorialService } from './tutorial.service';

@Controller()
export class TutorialController {
  constructor(private readonly tutorialService: TutorialService) {}

  /** Pip's script, the same for every planet. Not planet-scoped. */
  @NoPlanet()
  @Get('tutorial')
  get(): TutorialDto {
    return this.tutorialService.tutorial();
  }

  /** Not a command: no expectedVersion, and the version stays as it is. */
  @Patch('planet/tutorial')
  setStep(
    @CurrentPlanet() planetId: string,
    @Body() body: SetTutorialStepDto,
  ): Promise<TutorialProgressDto> {
    return this.tutorialService.setStep(planetId, body.step);
  }
}
