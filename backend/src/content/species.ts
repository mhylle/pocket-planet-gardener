import type { Species } from './content.types';

/** Creature species and their arrival conditions (CRT-01). */
export const SPECIES: readonly Species[] = [
  {
    id: 'worm',
    name: 'Worm',
    // The tutorial creature (ONB-02 AC2).
    arrivalCondition: { kind: 'first-bloom' },
    hint: 'Turns up as soon as your first flower blooms.',
  },
  {
    id: 'snail',
    name: 'Snail',
    arrivalCondition: {
      kind: 'all',
      of: [
        { kind: 'blooming', plant: 'clover', count: 3 },
        { kind: 'decoration', decoration: 'pond' },
      ],
    },
    hint: 'Likes ponds and plenty of clover.',
  },
  {
    id: 'bee',
    name: 'Bee',
    arrivalCondition: { kind: 'distinct-blooming', count: 3 },
    hint: 'Loves a garden with lots of different flowers in bloom.',
  },
  {
    id: 'moth',
    name: 'Moth',
    arrivalCondition: {
      kind: 'all',
      of: [
        { kind: 'decoration', decoration: 'lamp-post' },
        { kind: 'blooming', plant: 'moonflower', count: 2 },
      ],
    },
    hint: 'Drawn to lamp-posts and moonflowers.',
  },
  {
    id: 'hedgehog',
    name: 'Hedgehog',
    arrivalCondition: {
      kind: 'all',
      of: [
        { kind: 'decoration', decoration: 'rock' },
        { kind: 'blooming', plant: 'mushroom', count: 3 },
      ],
    },
    hint: 'Likes a rock to hide behind and mushrooms to snuffle.',
  },
  {
    id: 'frog',
    name: 'Frog',
    arrivalCondition: {
      kind: 'all',
      of: [
        { kind: 'decoration', decoration: 'pond' },
        { kind: 'blooming', plant: 'fern', count: 2 },
      ],
    },
    hint: 'Likes ponds and ferns.',
  },
];
