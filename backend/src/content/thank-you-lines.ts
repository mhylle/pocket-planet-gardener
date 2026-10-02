import type { SpeciesId } from './content.types';

/**
 * What a creature says when its wish comes true (WNT-03 AC1): short
 * scripted lines in each species' voice, so a fulfilment never waits for
 * the model. thank-you-lines.spec.ts holds them to the content rules.
 */
export const THANK_YOU_LINES: Readonly<Record<SpeciesId, readonly string[]>> = {
  worm: [
    'Wonderful, my tunnels feel fancier already. Thank you!',
    'You did it! Thank you, I am wiggling with joy.',
    'Thank you, gardener. The soil and I are very impressed.',
  ],
  snail: [
    'Oh my. Thank you, I shall admire it very, very slowly.',
    'How lovely! Thank you, my shell is practically sparkling.',
    'Thank you, kind gardener. Worth every slow little inch.',
  ],
  bee: [
    'Buzz-tastic! Thank you, gardener!',
    'Oh, this is the best thing since pollen. Thank you!',
    'Thank you! I could hum about this all day long.',
  ],
  moth: [
    'Oh, it is perfect. Thank you, gardener.',
    'Thank you! I shall flutter about it all night.',
    'How dreamy. Thank you, truly and softly.',
  ],
  hedgehog: [
    'Snuffle snuffle! Thank you, gardener!',
    'Oh, that is just right. Thank you kindly.',
    'Thank you! I am far too happy to curl up now.',
  ],
  frog: [
    'Ribbit! Thank you, gardener!',
    'Oh, splendid! Thank you, that deserves a big happy hop.',
    'Thank you! I could croak a little song about it.',
  ],
};
