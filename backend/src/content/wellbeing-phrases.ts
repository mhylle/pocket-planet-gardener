import { PLANTS } from './plants';
import { SPECIES } from './species';

// What a player's chat message may say about how they feel (AIB-03).
// Short, everyday wording only. Lowercase; wellbeing.ts normalises before
// comparing and drops apostrophes, so "im upset" matches "I'm upset".

/** Phrases that suggest the player feels sad, stressed or lonely (AIB-03 AC1). */
export const SAD_PHRASES: readonly string[] = [
  // Sad or low
  'sad',
  'unhappy',
  'miserable',
  'depressed',
  'heartbroken',
  'feeling down',
  'feel down',
  'really down',
  'so down',
  'feeling low',
  'feel low',
  'feel awful',
  'feel terrible',
  'want to cry',
  'been crying',
  'keep crying',
  'having a bad day',
  'had a bad day',
  'hate my life',
  // Stressed or upset
  'stressed',
  'anxious',
  'overwhelmed',
  'upset',
  // Lonely or left out
  'lonely',
  'nobody likes me',
  'no one likes me',
  'everyone hates me',
  'nobody cares about me',
  'no one cares about me',
  'have no friends',
  'left out',
  'bullied',
];

/**
 * Phrases that suggest the player may be in danger or thinking of hurting
 * themselves (AIB-03 AC2). Kept short and generic on purpose.
 */
export const DANGER_PHRASES: readonly string[] = [
  'hurt myself',
  'hurting myself',
  'harm myself',
  'harming myself',
  'self harm',
  'kill myself',
  'killing myself',
  'suicide',
  'suicidal',
  'end it all',
  'end my life',
  'want to die',
  'wanna die',
  "don't want to live",
  "don't want to be here anymore",
  "don't want to be here any more",
  'no reason to live',
  'want to disappear forever',
  'better off without me',
  'someone is hurting me',
  "i'm not safe",
  "don't feel safe",
];

/**
 * Things on the planet. A sad phrase after one of them ("the sunflower
 * looks sad") or before one ("a lonely snail") is about the planet, not the
 * player. A plural "s" is allowed.
 */
export const PLANET_WORDS: readonly string[] = [
  ...PLANTS.map((plant) => plant.id),
  ...SPECIES.map((species) => species.id),
  'cacti',
  'plant',
  'flower',
  'seed',
  'seedling',
  'sprout',
  'bud',
  'bloom',
  'leaf',
  'leaves',
  'petal',
  'garden',
  'creature',
  'critter',
  'bug',
  'planet',
  'cloud',
  'sun',
  'pond',
  'rock',
  'lamp',
  'bench',
  'house',
];

/** Words that may stand between a planet word and a sad phrase: "my clover is feeling down", "a lonely little snail". */
export const LINKING_WORDS: readonly string[] = [
  'is',
  'are',
  'was',
  'were',
  'looks',
  'look',
  'looked',
  'looking',
  'seems',
  'seem',
  'seemed',
  'feels',
  'feel',
  'felt',
  'feeling',
  'gets',
  'got',
  'getting',
  'has',
  'had',
  'having',
  'been',
  'a',
  'bit',
  'little',
  'kind',
  'of',
  'so',
  'very',
  'really',
  'quite',
  'pretty',
  'too',
];
