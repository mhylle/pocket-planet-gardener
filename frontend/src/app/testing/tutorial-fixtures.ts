import { TutorialDto } from '../core/models/tutorial';

/** Pip's script as GET /api/tutorial serves it, for the tutorial specs. */
export const TUTORIAL: TutorialDto = {
  steps: [
    { id: 'welcome', text: 'Hello, I am Pip! This little planet is yours.', highlight: 'none' },
    { id: 'rotate', text: 'Drag the planet to give it a spin.', highlight: 'canvas' },
    { id: 'open-inventory', text: 'Pick a clover seed from your pockets.', highlight: 'inventory' },
    { id: 'plant', text: 'Tap a free spot to plant it.', highlight: 'canvas' },
    { id: 'water', text: 'Grab a cloud and hold it over your seed.', highlight: 'sky' },
    { id: 'move-sun', text: 'Drag the sun so your seed gets some light.', highlight: 'sky' },
    { id: 'inspect', text: 'Tap your plant to see what it needs.', highlight: 'card' },
    { id: 'goodbye', text: 'You are a natural gardener. See you soon!', highlight: 'none' },
  ],
};
