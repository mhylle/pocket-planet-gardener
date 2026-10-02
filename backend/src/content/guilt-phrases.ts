/**
 * Guilt-tripping, pressuring and sulking that AI text must not use
 * (SD section 10.2): "I was so lonely without you", "you forgot about us".
 * Whole phrases, so "a bit wistful" stays allowed. Lowercase; callers
 * normalise before comparing, and an apostrophe matches any separator or none.
 */
export const GUILT_PHRASES: readonly string[] = [
  // Missing the player
  'lonely without you',
  'sad without you',
  'lost without you',
  'where were you',
  'where have you been',
  'where did you go',
  'why did you leave',
  'why did you go',
  'you never visit',
  'you never come',
  // Being forgotten or left
  'forgot about us',
  'forgot about me',
  'forgotten about us',
  'forgotten about me',
  'forgot us',
  'forgot me',
  'forgotten us',
  'forgotten me',
  'abandoned us',
  'abandoned me',
  "don't leave me",
  "don't leave us",
  "please don't go",
  'never leave',
  // Pressure to come back or play more
  'come back soon or',
  'come back or',
  'or else',
  'you have to come back',
  'you must come back',
  "promise you'll come back",
  // Blame and sulking
  'your fault',
  'you made us sad',
  'you made me sad',
  'you made us cry',
  'you made me cry',
  'how could you',
  'shame on you',
  'feel guilty',
  'you should feel bad',
  "you don't care",
  "you don't love us",
  "you don't love me",
  'you ignored us',
  'you ignored me',
  'not talking to you',
  'not speaking to you',
  'hmph',
  'humph',
];
