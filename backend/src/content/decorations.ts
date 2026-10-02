import type { DecorationType } from './content.types';

/** Decoration catalogue (ITM-03). */
export const DECORATIONS: readonly DecorationType[] = [
  {
    id: 'pond',
    name: 'Pond',
    footprintSteps: 3,
    isWater: true,
    description:
      'A small, splashy pond that is mostly puddle and entirely charming. Frogs and snails give it five stars.',
    unlockHint: 'A creature with a wish might reward you with one.',
  },
  {
    id: 'rock',
    name: 'Rock',
    footprintSteps: 1,
    isWater: false,
    description:
      'A perfectly ordinary rock with an extraordinary amount of confidence. Excellent for hiding behind.',
    unlockHint: 'Somebody small and grateful may roll one your way.',
  },
  {
    id: 'lamp-post',
    name: 'Lamp-post',
    footprintSteps: 1,
    isWater: false,
    description:
      'A tiny lamp-post that glows warmly all night long. Moths have very strong opinions about it.',
    unlockHint: 'Grant a few wishes and see what lights up.',
  },
  {
    id: 'bench',
    name: 'Bench',
    footprintSteps: 2,
    isWater: false,
    description:
      'A little wooden bench, perfect for watching the clouds drift by. Somebody always seems to be sitting on it.',
    unlockHint: 'A happy creature might bring you one to sit on.',
  },
  {
    id: 'tiny-house',
    name: 'Tiny house',
    footprintSteps: 3,
    isWater: false,
    description:
      'A house so tiny that the front door is mostly for show. Everyone likes to peek through the windows anyway.',
    unlockHint: 'Fulfil enough wishes and one may turn up as a reward.',
  },
];
