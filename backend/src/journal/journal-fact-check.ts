import { wordCount } from '../ai/content-rules';
import { DECORATIONS } from '../content/decorations';
import { FALLBACK_IDENTITIES } from '../content/fallback-identities';
import { PLANTS } from '../content/plants';
import { SPECIES } from '../content/species';

// The journal's fact check (JRN-02) and the template entry used when the
// model cannot write one (AIB-05). The check is a set of heuristics over the
// text, aimed at the usual inventions: a creature that does not live here,
// an event that did not happen, more blooms than there were.

/** A logged event as the check and the template read it. */
export interface JournalEvent {
  type: string;
  payload: Record<string, unknown>;
}

/** What an entry may be true to. */
export interface JournalFacts {
  // Everything logged since the previous entry, oldest first.
  events: readonly JournalEvent[];
  // Every creature living on the planet.
  creatureNames: readonly string[];
  planetName: string;
  maxWords: number;
}

/** One way an entry breaks the facts. */
export type JournalViolation =
  | 'unknown-creature'
  | 'invented-gift'
  | 'invented-arrival'
  | 'invented-bloom'
  | 'invented-wish'
  | 'wrong-count'
  | 'too-long';

/** "About 150 words" (JRN-01 AC1): the template never writes more. */
export const TEMPLATE_MAX_WORDS = 150;

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** The date as an entry is headed, such as "Thursday 2 October", in UTC. */
export function journalDate(date: Date): string {
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

const BLOOMED = 'plant-bloomed';
const ARRIVED = 'creature-arrived';
const WISHED = 'want-fulfilled';
const GIFTED = 'gift-received';

/** Every name of the pre-written pool: a model that names one of them likely made it up. */
const POOL_NAMES = Object.values(FALLBACK_IDENTITIES).flatMap((pool) =>
  pool.map((identity) => identity.name),
);

/** Animals a made-up creature may be called, "Zorblax the snail": the species and their likes. */
const ANIMALS = [
  ...SPECIES.map((species) => species.id),
  'ant',
  'beetle',
  'bird',
  'butterfly',
  'caterpillar',
  'cricket',
  'dragonfly',
  'firefly',
  'fox',
  'grasshopper',
  'ladybird',
  'ladybug',
  'mouse',
  'newt',
  'owl',
  'rabbit',
  'slug',
  'spider',
  'squirrel',
  'toad',
].join('|');

/** One or more capitalised words right before "the <animal>". */
const NAME_THE_ANIMAL = new RegExp(
  `((?:\\p{Lu}[\\p{L}'’-]*\\s+)*\\p{Lu}[\\p{L}'’-]*)\\s+the\\s+(?:${ANIMALS})s?\\b`,
  'gu',
);

/** "a snail called Zorblax". */
const ANIMAL_CALLED_NAME = new RegExp(
  `\\b(?:${ANIMALS})s?\\s+(?:called|named)\\s+(\\p{Lu}[\\p{L}'’-]*)`,
  'gu',
);

/**
 * Capitalised words that are no creature's name: the calendar, the
 * gardener, Pip, and words that start a sentence such as "Then the snail
 * napped". The catalogue and the planet name are added per check.
 */
const NOT_NAMES = new Set(
  [
    ...WEEKDAYS,
    ...MONTHS,
    'gardener',
    'pip',
    'diary',
    'dear',
    'meanwhile',
    'then',
    'later',
    'soon',
    'today',
    'tonight',
    'yesterday',
    'tomorrow',
    'suddenly',
    'finally',
    'afterwards',
    'after',
    'before',
    'also',
    'and',
    'but',
    'so',
    'now',
    'once',
    'still',
    'even',
    'luckily',
    'happily',
    'naturally',
    'of',
    'in',
    'on',
    'at',
    'by',
    'with',
    'when',
    'while',
    'as',
    'if',
    'because',
    'since',
    'until',
    'all',
    'every',
    'each',
    'our',
    'your',
    'my',
    'his',
    'her',
    'their',
    'its',
    'this',
    'that',
    'there',
    'here',
    'oh',
    'well',
    'morning',
    'evening',
    'afternoon',
    'night',
  ].map((word) => word.toLowerCase()),
);

/** Catalogue words, lower-cased and split, so "Tiny house" gives "tiny" and "house". */
const CATALOGUE_WORDS = [
  ...PLANTS.map((plant) => plant.name),
  ...DECORATIONS.map((decoration) => decoration.name),
  ...SPECIES.map((species) => species.name),
].flatMap((name) => name.toLowerCase().split(/\s+/));

/** Words claiming an event, each needing its event type in the log. */
const EVENT_WORDS: readonly {
  violation: JournalViolation;
  type: string;
  pattern: RegExp;
}[] = [
  {
    violation: 'invented-gift',
    type: GIFTED,
    pattern: /\b(?:gifts?|gifted|parcels?|presents?)\b/i,
  },
  {
    violation: 'invented-arrival',
    type: ARRIVED,
    pattern:
      /\b(?:arrived|arrives|arriving|arrival|mov(?:ed|es|ing) in|new neighbou?rs?)\b/i,
  },
  {
    violation: 'invented-bloom',
    type: BLOOMED,
    pattern: /\b(?:bloomed|blossomed)\b/i,
  },
  {
    violation: 'invented-wish',
    type: WISHED,
    pattern:
      /\bwish(?:es)?\s+(?:(?:has|have|had)\s+)?(?:came|come)\s+true\b|\bwish(?:es)?\s+(?:was|were|got|(?:has|have|had)\s+been)\s+granted\b|\bgrant(?:ed|s)?\s+(?:\w+\s+)?wish(?:es)?\b/i,
  },
];

const NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

/** A plant's plural, as the template and the count check spell it. */
function plural(name: string): string {
  return name === 'cactus' ? 'cacti' : `${name}s`;
}

const PLANT_WORDS = [
  ...PLANTS.flatMap((plant) => {
    const name = plant.name.toLowerCase();
    return [name, plural(name)];
  }),
  'cactuses',
  'flowers?',
  'blooms?',
  'blossoms?',
  'plants?',
].join('|');

/**
 * A number of two or more, then up to two words, then a plant word: "three
 * tiny clovers", "5 blooms". A lone "one" is no count claim.
 */
const COUNTED_PLANTS = new RegExp(
  `\\b(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s+(?:[\\p{L}'’-]+\\s+){0,2}?(?:${PLANT_WORDS})\\b`,
  'giu',
);

function lowerCased(names: readonly string[]): Set<string> {
  return new Set(names.map((name) => name.trim().toLowerCase()));
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when the text names a creature that is not on the planet. */
function namesUnknownCreature(text: string, facts: JournalFacts): boolean {
  const known = lowerCased(facts.creatureNames);
  const notNames = new Set([
    ...NOT_NAMES,
    ...CATALOGUE_WORDS,
    ...facts.planetName.toLowerCase().split(/\s+/),
  ]);
  const planetName = facts.planetName.trim().toLowerCase();

  const poolNameUsed = POOL_NAMES.some((name) => {
    const lower = name.toLowerCase();
    return (
      !known.has(lower) &&
      lower !== planetName &&
      !notNames.has(lower) &&
      new RegExp(`(?<![\\p{L}])${escaped(name)}(?![\\p{L}])`, 'u').test(text)
    );
  });
  if (poolNameUsed) {
    return true;
  }

  for (const [, captured] of text.matchAll(NAME_THE_ANIMAL)) {
    const words = captured.split(/\s+/);
    // "Then Wigglenut the worm": a known name may end the run of capitals.
    const knownSuffix = words.some((_, start) =>
      known.has(words.slice(start).join(' ').toLowerCase()),
    );
    const last = words[words.length - 1].toLowerCase();
    if (!knownSuffix && !notNames.has(last)) {
      return true;
    }
  }
  for (const [, name] of text.matchAll(ANIMAL_CALLED_NAME)) {
    if (!known.has(name.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** True when the text counts more blooms than were logged. */
function overcounts(text: string, blooms: number): boolean {
  for (const [, count] of text.matchAll(COUNTED_PLANTS)) {
    const value = NUMBER_WORDS[count.toLowerCase()] ?? Number(count);
    if (value >= 2 && value > blooms) {
      return true;
    }
  }
  return false;
}

/**
 * Every way the entry breaks the facts, each once; [] means it may be kept
 * (JRN-02). Names a creature not on the planet (AC2), claims a gift,
 * arrival, bloom or granted wish the log does not hold (AC1), counts more
 * blooms than were logged, or is longer than maxWords. Harmless colour such
 * as feelings, jokes, the weather or a nap passes (AC3).
 */
export function verify(text: string, facts: JournalFacts): JournalViolation[] {
  const types = new Set(facts.events.map((event) => event.type));
  const violations: JournalViolation[] = [];
  if (namesUnknownCreature(text, facts)) {
    violations.push('unknown-creature');
  }
  for (const { violation, type, pattern } of EVENT_WORDS) {
    if (!types.has(type) && pattern.test(text)) {
      violations.push(violation);
    }
  }
  const blooms = facts.events.filter((event) => event.type === BLOOMED).length;
  if (overcounts(text, blooms)) {
    violations.push('wrong-count');
  }
  if (wordCount(text) > facts.maxWords) {
    violations.push('too-long');
  }
  return violations;
}

/** A random number in [0, 1), such as Math.random; the service seeds it by date. */
export type Rng = () => number;

/**
 * A generator that gives the same numbers for the same UTC day, so the
 * template varies from day to day (mulberry32).
 */
export function dateRng(date: Date): Rng {
  let state = Math.floor(date.getTime() / 86_400_000) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNT_WORDS = Object.entries(NUMBER_WORDS)
  .filter(([word]) => word !== 'dozen')
  .reduce<Record<number, string>>((words, [word, value]) => {
    words[value] = word;
    return words;
  }, {});

const PLANT_NAMES = Object.fromEntries(
  PLANTS.map((plant) => [plant.id, plant.name.toLowerCase()]),
) as Record<string, string>;

/** What a newcomer of each species did first: harmless colour, no claims about the planet. */
const FIRST_DEEDS: Record<string, string> = {
  worm: 'gave the soil top marks after a careful taste',
  snail: 'took the scenic route to absolutely everywhere',
  bee: 'hummed a cheerful hello to every flower',
  moth: 'fluttered about looking for the cosiest glow',
  hedgehog: 'curled up into a very round ball of contentment',
  frog: 'practised a few celebratory hops',
};

type Line = (weekday: string, planet: string) => string;
type NameLine = (name: string) => string;

const QUIET_OPENINGS: readonly Line[] = [
  (weekday, planet) => `A quiet ${weekday} on ${planet}.`,
  (weekday, planet) =>
    `Nothing much happened on ${planet} this ${weekday}, which suited everyone perfectly.`,
  (weekday, planet) =>
    `Dear diary, ${planet} had the sleepiest ${weekday} in a long while.`,
];

const BUSY_OPENINGS: readonly Line[] = [
  (weekday, planet) => `What a ${weekday} it has been on ${planet}!`,
  (weekday, planet) => `Dear diary, ${planet} had a busy ${weekday}.`,
  (weekday, planet) => `Big news from ${planet} this ${weekday}.`,
];

const WEATHER_LINES: readonly string[] = [
  'The clouds drifted by at their own gentle pace, and the sun took a slow stroll around the sky.',
  'A soft breeze tickled the leaves, and the whole planet seemed to yawn.',
  'The clouds wandered past like sleepy sheep, in no hurry at all.',
];

const NAP_LINES: readonly NameLine[] = [
  (name) =>
    `${name} took a long nap and woke up only to announce it was time for another.`,
  (name) =>
    `${name} spent ages watching the clouds and called it important research.`,
  (name) =>
    `${name} found a cosy spot and practised doing absolutely nothing, with great success.`,
];

const CLOSING_LINES: readonly NameLine[] = [
  (name) => `${name} declared it the best day so far and went for a nap.`,
  (name) =>
    `By evening, ${name} was far too excited to sleep, and then fell asleep anyway.`,
  (name) =>
    `${name} thinks the planet has never looked better, and ${name} is rarely wrong.`,
];

const ONE_BLOOM_TAILS: readonly string[] = [
  ' bloomed and looked very pleased with itself.',
  ' bloomed, which was the talk of the planet all afternoon.',
  ' bloomed and spent the rest of the day showing off.',
];

const MANY_BLOOMS_TAILS: readonly string[] = [
  ' bloomed, and the planet looked as if it had dressed up for a party.',
  ' bloomed. The whole garden seemed to stand up a little straighter.',
  ' bloomed, each one trying very hard to be the most colourful.',
];

/** Picks one of the items with the template's rng. */
type Chooser = <T>(items: readonly T[]) => T;

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function listed(items: readonly string[]): string {
  return items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function nameOf(event: JournalEvent): string | undefined {
  const { name } = event.payload;
  return typeof name === 'string' && name.trim() !== ''
    ? name.trim()
    : undefined;
}

/** "Three clovers and a sunflower bloomed, ...": every bloom, by plant type. */
function bloomLine(blooms: readonly JournalEvent[], pick: Chooser): string {
  const counts = new Map<string, number>();
  for (const bloom of blooms) {
    const type = bloom.payload.type;
    const name =
      (typeof type === 'string' ? PLANT_NAMES[type] : undefined) ?? 'flower';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const parts = [...counts].map(([name, count]) =>
    count === 1
      ? `a ${name}`
      : `${COUNT_WORDS[count] ?? String(count)} ${plural(name)}`,
  );
  const tail = pick(blooms.length === 1 ? ONE_BLOOM_TAILS : MANY_BLOOMS_TAILS);
  return `${capitalised(listed(parts))}${tail}`;
}

function arrivalLine(arrival: JournalEvent, pick: Chooser): string {
  const { species } = arrival.payload;
  const kind = typeof species === 'string' ? species : 'creature';
  const deed = FIRST_DEEDS[kind] ?? 'had a good look around';
  const name = nameOf(arrival);
  if (!name) {
    return `A new ${kind} moved in and ${deed}.`;
  }
  return pick([
    `${name} the ${kind} moved in and ${deed}.`,
    `There was a new neighbour: ${name} the ${kind}, who ${deed}.`,
  ]);
}

function wishLine(wish: JournalEvent, pick: Chooser): string {
  const name = nameOf(wish);
  if (!name) {
    return 'A wish came true, and there was a small but very proud dance about it.';
  }
  return pick([
    `${name}'s wish came true, and there was a small but very proud dance about it.`,
    `${name}'s wish came true, and ${name} has not stopped beaming since.`,
  ]);
}

function giftLine(gift: JournalEvent, pick: Chooser): string {
  const name = nameOf(gift) ?? 'Someone';
  return pick([
    `${name} was so overjoyed that they left a little gift for you.`,
    `${name} left you a gift, wrapped in nothing but good intentions.`,
  ]);
}

/**
 * A cosy entry built only from the events (JRN-02 AC4, AIB-05): the blooms,
 * the newcomers by name, the wishes that came true and the gifts, closed by a
 * real creature when the planet has one. With nothing to tell it is a short
 * page about the weather and a creature's nap that invents nothing (AC3).
 * At most TEMPLATE_MAX_WORDS words (or maxWords, if fewer): on a very busy
 * day the last news lines are left out. rng picks the wording.
 */
export function templateEntry(
  events: readonly JournalEvent[],
  facts: JournalFacts,
  date: Date,
  rng: Rng,
): string {
  const pick: Chooser = (items) =>
    items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  const weekday = WEEKDAYS[date.getUTCDay()];
  const planet = facts.planetName;
  const ofType = (type: string) =>
    events.filter((event) => event.type === type);
  const blooms = ofType(BLOOMED);

  const news = [
    ...(blooms.length > 0 ? [bloomLine(blooms, pick)] : []),
    ...ofType(ARRIVED).map((arrival) => arrivalLine(arrival, pick)),
    ...ofType(WISHED).map((wish) => wishLine(wish, pick)),
    ...ofType(GIFTED).map((gift) => giftLine(gift, pick)),
  ];
  const creature =
    facts.creatureNames.length > 0 ? pick(facts.creatureNames) : undefined;

  let lines: string[];
  if (news.length === 0) {
    lines = [
      pick(QUIET_OPENINGS)(weekday, planet),
      pick(WEATHER_LINES),
      ...(creature ? [pick(NAP_LINES)(creature)] : []),
    ];
  } else {
    const closing = creature
      ? pick(CLOSING_LINES)(creature)
      : pick(WEATHER_LINES);
    const opening = pick(BUSY_OPENINGS)(weekday, planet);
    const maxWords = Math.min(TEMPLATE_MAX_WORDS, facts.maxWords);
    while (
      news.length > 1 &&
      wordCount([opening, ...news, closing].join(' ')) > maxWords
    ) {
      news.pop();
    }
    lines = [opening, ...news, closing];
  }
  return lines.join(' ');
}
