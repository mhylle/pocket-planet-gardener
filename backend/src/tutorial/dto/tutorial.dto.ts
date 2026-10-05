import type { TutorialStep } from '../../content/tutorial';

/** GET /api/tutorial: Pip's steps in order; a step's number is its index. */
export interface TutorialDto {
  steps: readonly TutorialStep[];
}

/** PATCH /api/planet/tutorial: the step kept, -1 once finished or skipped. */
export interface TutorialProgressDto {
  tutorialStep: number;
}
