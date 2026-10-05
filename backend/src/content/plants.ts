import type { PlantType } from './content.types';

/** Plant catalogue (ITM-03). Needs follow the SD table; times suit a cosy pace. */
export const PLANTS: readonly PlantType[] = [
  {
    id: 'clover',
    name: 'Clover',
    waterPref: 'medium',
    lightPref: 'partial',
    // Tutorial plant: must bloom within 10 minutes of play (ONB-02 AC1),
    // even at half speed for one unmet need, such as the night side.
    bloomMinutes: 5,
    description:
      'Pops up and blooms almost before you have finished planting it. Snails think it is the finest salad on the planet.',
    unlockHint: 'One of the seeds every new planet starts with.',
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    waterPref: 'medium',
    lightPref: 'full-sun',
    // About 2 hours, as in TIM-01 AC1.
    bloomMinutes: 120,
    description:
      'Follows the sun around the sky, even when you are the one dragging it. Very tall, very polite.',
    unlockHint: 'One of the seeds every new planet starts with.',
  },
  {
    id: 'tulip',
    name: 'Tulip',
    waterPref: 'medium',
    lightPref: 'full-sun',
    bloomMinutes: 60,
    description:
      'Stands up very straight, as if it is waiting to have its picture taken. Loves a sunny spot and a sip of rain.',
    unlockHint: 'Creatures sometimes hand these out as thank-you presents.',
  },
  {
    id: 'bluebell',
    name: 'Bluebell',
    waterPref: 'high',
    lightPref: 'partial',
    bloomMinutes: 90,
    description:
      'Rings a tiny bell that nobody has ever actually heard. Drinks rain like it is going out of fashion.',
    unlockHint:
      "Grant a creature's wish and you might find some in your pocket.",
  },
  {
    id: 'moonflower',
    name: 'Moonflower',
    waterPref: 'medium',
    lightPref: 'shade',
    bloomMinutes: 150,
    description:
      'Opens up in the shade as if it has a secret to share. Moths find it completely irresistible.',
    unlockHint: 'Rumour has it a grateful creature keeps a few tucked away.',
  },
  {
    id: 'mushroom',
    name: 'Mushroom',
    waterPref: 'high',
    lightPref: 'shade',
    bloomMinutes: 45,
    description:
      'Not technically a plant, but nobody has had the heart to tell it. Prefers damp, shady corners.',
    unlockHint: 'One of the seeds every new planet starts with.',
  },
  {
    id: 'fern',
    name: 'Fern',
    waterPref: 'high',
    lightPref: 'shade',
    bloomMinutes: 75,
    description:
      'Has been green since long before green was fashionable. Likes it damp, shady and a little bit mysterious.',
    unlockHint: 'A happy creature might bring you some one day.',
  },
  {
    id: 'cactus',
    name: 'Cactus',
    waterPref: 'low',
    lightPref: 'full-sun',
    bloomMinutes: 180,
    description:
      'Needs hardly any water and blooms when it jolly well feels like it. Prickly on the outside, a big softie on the inside.',
    unlockHint: 'Fulfil enough wishes and one may turn up as a reward.',
  },
];
