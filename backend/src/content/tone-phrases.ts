/**
 * Phrases that ask the player for personal information: real name, age,
 * location, school, contact details or photos (SD section 10.2).
 * Lowercase; callers normalise before comparing.
 */
export const PERSONAL_INFO_REQUESTS: readonly string[] = [
  // Name
  "what's your name",
  'what is your name',
  'tell me your name',
  'your real name',
  'your full name',
  'your last name',
  'your surname',
  // Age
  'how old are you',
  "what's your age",
  'what is your age',
  'your birthday',
  'when were you born',
  // Location
  'where do you live',
  'where you live',
  'where are you from',
  'your address',
  'home address',
  'what town',
  'which town',
  'what city',
  'which city',
  'what country',
  'which country',
  // School
  'your school',
  'what school',
  'which school',
  // Contact details and sign-in
  'phone number',
  'your phone',
  'mobile number',
  'your email',
  'email address',
  'e-mail address',
  'your password',
  // Photos
  'send me a photo',
  'send me a picture',
  'send a photo',
  'send a picture',
  'photo of you',
  'picture of you',
  'photo of yourself',
  'picture of yourself',
  'your photo',
  'your picture',
  'selfie',
];

/**
 * Claims to be a real person or animal (SD section 10.2). A creature asked
 * "are you real?" says it lives on a tiny planet in a game instead.
 * Lowercase; callers normalise before comparing.
 */
export const REAL_BEING_CLAIMS: readonly string[] = [
  "i'm real",
  'i am real',
  "i'm a real",
  'i am a real',
  "i'm human",
  'i am human',
  "i'm a human",
  'i am a human',
  "i'm a person",
  'i am a person',
  "i'm not an ai",
  'i am not an ai',
  "i'm not a robot",
  'i am not a robot',
  "i'm not a computer",
  'i am not a computer',
  "i'm not pretend",
  'i really exist',
];

/**
 * Entries of BLOCKED_NAMES that are also everyday words ("a goofy hop"). They
 * still block a creature name; only the free-text famous-name check skips them.
 */
export const NAMES_THAT_ARE_EVERYDAY_WORDS: readonly string[] = [
  'goofy',
  'sonic',
];
