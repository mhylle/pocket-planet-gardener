/** The steps of Pip's tutorial, in order (ONB-01). */
export type TutorialStepId =
  | 'welcome'
  | 'rotate'
  | 'open-inventory'
  | 'plant'
  | 'water'
  | 'move-sun'
  | 'inspect'
  | 'goodbye';

/** The part of the planet screen a step is about, which Pip points at. */
export type TutorialHighlight = 'canvas' | 'inventory' | 'sky' | 'card' | 'none';

/** One thing Pip asks the player to do. */
export interface TutorialStepDto {
  id: TutorialStepId;
  text: string;
  highlight: TutorialHighlight;
}

/** The 200 response of GET /api/tutorial; a step's number is its index. */
export interface TutorialDto {
  steps: TutorialStepDto[];
}

/** The 200 response of PATCH /api/planet/tutorial. */
export interface TutorialProgressDto {
  /** The step the planet has reached; -1 once the tutorial is finished. */
  tutorialStep: number;
}
