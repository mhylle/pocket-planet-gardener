/** Pip's steps (ONB-01). A step's number is its index in TUTORIAL_STEPS. */
export type TutorialStepId =
  | 'welcome'
  | 'rotate'
  | 'open-inventory'
  | 'plant'
  | 'water'
  | 'move-sun'
  | 'inspect'
  | 'goodbye';

/** The part of the screen a step points at. */
export type TutorialHighlight =
  'canvas' | 'inventory' | 'sky' | 'card' | 'none';

export interface TutorialStep {
  id: TutorialStepId;
  /** What Pip says: warm and short, at most 2 sentences (SD section 10). */
  text: string;
  highlight: TutorialHighlight;
}

/**
 * Pip's script (ONB-01). Pip is a small friendly cloud and scripted, not AI.
 * The client moves on only once the player has done what a step asks (AC2)
 * and keeps the step reached on the planet (AC4). tutorial.spec.ts holds
 * every line to the content rules.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    text: "Hello, I'm Pip, a small cloud with big plans for your planet! Shall we get it growing?",
    highlight: 'none',
  },
  {
    id: 'rotate',
    text: 'Drag your planet (or use the arrow keys) to give it a gentle spin.',
    highlight: 'canvas',
  },
  {
    id: 'open-inventory',
    text: 'Your seeds are tucked away in your inventory. Open it up and have a peek!',
    highlight: 'inventory',
  },
  {
    id: 'plant',
    text: 'Pick the clover seed and tap a free spot to plant it.',
    highlight: 'inventory',
  },
  {
    id: 'water',
    text: 'Hold one of my cloud friends over your seed to give it a drink. On a keyboard, Tab to the sky list and press Space to rain.',
    highlight: 'sky',
  },
  {
    id: 'move-sun',
    text: 'Now drag the sun so its light reaches your seed.',
    highlight: 'sky',
  },
  {
    id: 'inspect',
    text: 'Tap your plant to see how it feels.',
    highlight: 'canvas',
  },
  {
    id: 'goodbye',
    text: "Lovely work! I'll float nearby — tap me any time you need a hand.",
    highlight: 'none',
  },
];
