import { IsInt } from 'class-validator';

/** Body of PATCH /api/planet/tutorial. */
export class SetTutorialStepDto {
  // Only the type is checked here. Which steps may follow the current one
  // is TutorialService's rule, so its 400 carries a friendly message.
  @IsInt()
  step!: number;
}
