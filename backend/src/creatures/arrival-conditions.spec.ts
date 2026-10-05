import type {
  DecorationId,
  PlantId,
  SpeciesId,
} from '../content/content.types';
import { SPECIES } from '../content/species';
import {
  attractions,
  evaluateArrivals,
  gardenView,
  isConditionMet,
  type ArrivalInput,
  type ArrivalTracking,
  type GardenView,
} from './arrival-conditions';

const T0 = new Date('2030-01-01T00:00:00.000Z');
const CFG = {
  arrivalDelaySeconds: 120,
  arrivalSpacingMinutes: 30,
  maxCreatures: 8,
  maxPerSpecies: 2,
};

const DAY_SECONDS = 24 * 3600;

function at(seconds: number): Date {
  return new Date(T0.getTime() + seconds * 1000);
}

function blooms(type: PlantId, n: number) {
  return Array.from({ length: n }, () => ({ type, stage: 'bloom' }));
}

function garden(
  plants: { type: PlantId; stage: string }[],
  decorations: DecorationId[] = [],
): GardenView {
  return gardenView(
    plants,
    decorations.map((type) => ({ type })),
  );
}

function condition(species: SpeciesId) {
  return SPECIES.find((each) => each.id === species)!.arrivalCondition;
}

function creatures(...species: SpeciesId[]) {
  return species.map((each) => ({ species: each }));
}

// Three blooming clovers and a pond: the worm's and the snail's conditions.
const SNAIL_GARDEN = garden(blooms('clover', 3), ['pond']);

function evaluate(input: Partial<ArrivalInput> & { now: Date }) {
  return evaluateArrivals({
    garden: SNAIL_GARDEN,
    creatures: [],
    tracking: {},
    away: false,
    cfg: CFG,
    ...input,
  });
}

describe('gardenView', () => {
  it('counts blooming plants per type, and the decoration types', () => {
    const view = garden(
      [
        ...blooms('clover', 2),
        { type: 'clover', stage: 'young' },
        ...blooms('fern', 1),
        { type: 'tulip', stage: 'seed' },
      ],
      ['pond', 'rock', 'pond'],
    );

    expect(view.blooming).toEqual({ clover: 2, fern: 1 });
    expect([...view.decorations].sort()).toEqual(['pond', 'rock']);
    expect(view.distinctBlooming).toBe(2);
    expect(view.anyBloom).toBe(true);
  });

  it('sees no bloom in a garden of seedlings', () => {
    const view = garden([{ type: 'clover', stage: 'sprout' }]);

    expect(view).toMatchObject({
      blooming: {},
      distinctBlooming: 0,
      anyBloom: false,
    });
  });
});

describe('isConditionMet', () => {
  it('meets the snail with 3 blooming clovers and a pond, not with 2 or without the pond', () => {
    const snail = condition('snail');

    expect(isConditionMet(snail, SNAIL_GARDEN)).toBe(true);
    expect(isConditionMet(snail, garden(blooms('clover', 2), ['pond']))).toBe(
      false,
    );
    expect(isConditionMet(snail, garden(blooms('clover', 3)))).toBe(false);
  });

  it('counts a clover only once it blooms', () => {
    const view = garden(
      [...blooms('clover', 2), { type: 'clover', stage: 'young' }],
      ['pond'],
    );

    expect(isConditionMet(condition('snail'), view)).toBe(false);
  });

  it('meets the worm with any bloom at all, not before', () => {
    const worm = condition('worm');

    expect(isConditionMet(worm, garden(blooms('mushroom', 1)))).toBe(true);
    expect(
      isConditionMet(worm, garden([{ type: 'clover', stage: 'young' }])),
    ).toBe(false);
  });

  it('meets the bee with 3 different types in bloom, not 3 of one type', () => {
    const bee = condition('bee');

    expect(
      isConditionMet(
        bee,
        garden([
          ...blooms('clover', 1),
          ...blooms('tulip', 1),
          ...blooms('fern', 1),
        ]),
      ),
    ).toBe(true);
    expect(isConditionMet(bee, garden(blooms('clover', 3)))).toBe(false);
  });
});

describe('attractions', () => {
  const plants = [
    { id: 'young-clover', type: 'clover' as const, stage: 'young' },
    { id: 'clover', type: 'clover' as const, stage: 'bloom' },
    { id: 'fern', type: 'fern' as const, stage: 'bloom' },
  ];
  const decorations = [
    { id: 'rock', type: 'rock' as const },
    { id: 'pond', type: 'pond' as const },
  ];
  const ids = (things: { id: string }[]) => things.map((thing) => thing.id);

  it("gives the snail's pond, then its blooming clovers", () => {
    expect(ids(attractions(condition('snail'), plants, decorations))).toEqual([
      'pond',
      'clover',
    ]);
  });

  it('gives the worm and the bee every bloom', () => {
    expect(ids(attractions(condition('worm'), plants, decorations))).toEqual([
      'clover',
      'fern',
    ]);
    expect(ids(attractions(condition('bee'), plants, decorations))).toEqual([
      'clover',
      'fern',
    ]);
  });

  it('gives nothing when none of the parts is on the planet', () => {
    expect(attractions(condition('moth'), plants, decorations)).toEqual([]);
  });
});

describe('evaluateArrivals', () => {
  // The worm lives there already, so the snail is the one due.
  const WORM = creatures('worm');

  it('lets the snail arrive once met for 2 minutes, not after 1', () => {
    const first = evaluate({ now: T0, creatures: WORM });
    expect(first.arrival).toBeNull();
    expect(first.tracking.species.snail).toEqual({
      metSince: T0.toISOString(),
    });

    const oneMinute = evaluate({
      now: at(60),
      creatures: WORM,
      tracking: first.tracking,
    });
    expect(oneMinute.arrival).toBeNull();
    expect(oneMinute.tracking.species.snail).toEqual({
      metSince: T0.toISOString(),
    });

    const twoMinutes = evaluate({
      now: at(120),
      creatures: WORM,
      tracking: oneMinute.tracking,
    });
    expect(twoMinutes.arrival).toBe('snail');
    expect(twoMinutes.tracking.lastArrivalAt).toBe(at(120).toISOString());
  });

  it('lets one of two met species arrive now, the other only 30 minutes later', () => {
    const met: ArrivalTracking = {
      species: {
        worm: { metSince: T0.toISOString() },
        snail: { metSince: T0.toISOString() },
      },
      lastArrivalAt: null,
    };

    const first = evaluate({ now: at(120), tracking: met });
    expect(first.arrival).toBe('worm');

    const soon = evaluate({
      now: at(120 + 29 * 60),
      creatures: WORM,
      tracking: first.tracking,
    });
    expect(soon.arrival).toBeNull();
    expect(soon.tracking.lastArrivalAt).toBe(at(120).toISOString());

    const later = evaluate({
      now: at(120 + 30 * 60),
      creatures: WORM,
      tracking: soon.tracking,
    });
    expect(later.arrival).toBe('snail');
    expect(later.tracking.lastArrivalAt).toBe(at(120 + 30 * 60).toISOString());
  });

  it('lets one worm arrive for the first bloom, never a second, however long it blooms', () => {
    const result = evaluate({
      now: at(DAY_SECONDS),
      garden: garden(blooms('mushroom', 1)),
      creatures: WORM,
      tracking: {
        species: { worm: { metSince: T0.toISOString() } },
        lastArrivalAt: T0.toISOString(),
      },
      away: true,
    });

    expect(result.arrival).toBeNull();
  });

  it('brings no second worm 30 minutes after the first, but the snail', () => {
    const afterWorm: ArrivalTracking = {
      species: {
        worm: { metSince: T0.toISOString() },
        snail: { metSince: T0.toISOString() },
      },
      lastArrivalAt: at(120).toISOString(),
    };

    const result = evaluate({
      now: at(120 + 30 * 60),
      creatures: WORM,
      tracking: afterWorm,
    });

    expect(result.arrival).toBe('snail');
    expect(result.tracking.species.worm).toEqual({
      metSince: T0.toISOString(),
    });
  });

  it('picks the first due species in species order', () => {
    const result = evaluate({ now: T0, away: true });

    expect(SPECIES.map((each) => each.id).slice(0, 2)).toEqual([
      'worm',
      'snail',
    ]);
    expect(result.arrival).toBe('worm');
  });

  it('lets nobody arrive on a planet with 8 creatures, even after away time', () => {
    const full = creatures(
      'bee',
      'bee',
      'moth',
      'moth',
      'hedgehog',
      'hedgehog',
      'frog',
      'frog',
    );

    const result = evaluate({ now: T0, creatures: full, away: true });

    expect(result.arrival).toBeNull();
    // Still tracked, so a creature can follow once there is room.
    expect(result.tracking.species.snail).toEqual({
      metSince: T0.toISOString(),
    });
    expect(result.tracking.lastArrivalAt).toBeNull();
  });

  it('never lets a third snail arrive', () => {
    const result = evaluate({
      now: at(DAY_SECONDS),
      creatures: creatures('worm', 'snail', 'snail'),
      tracking: {
        species: { snail: { metSince: T0.toISOString() } },
        lastArrivalAt: null,
      },
      away: true,
    });

    expect(result.arrival).toBeNull();
  });

  it('lets a met species arrive at once after away time, without the delay', () => {
    const result = evaluate({ now: T0, away: true });

    expect(result.arrival).toBe('worm');
    expect(result.tracking.lastArrivalAt).toBe(T0.toISOString());
  });

  it("lets the planet's first creature arrive as soon as its condition holds, without the delay (ONB-02 AC2)", () => {
    const result = evaluate({ now: T0, garden: garden(blooms('clover', 1)) });

    expect(result.arrival).toBe('worm');
    expect(result.tracking.lastArrivalAt).toBe(T0.toISOString());
    expect(result.tracking.species.worm).toEqual({
      metSince: T0.toISOString(),
    });
  });

  it('keeps the delay for every arrival after the first', () => {
    const first = evaluate({ now: T0, garden: garden(blooms('clover', 1)) });
    expect(first.arrival).toBe('worm');

    // The snail's condition holds from 40 minutes on, past the spacing.
    const met = evaluate({
      now: at(40 * 60),
      creatures: WORM,
      tracking: first.tracking,
    });
    expect(met.arrival).toBeNull();
    const oneMinute = evaluate({
      now: at(41 * 60),
      creatures: WORM,
      tracking: met.tracking,
    });
    expect(oneMinute.arrival).toBeNull();
    const twoMinutes = evaluate({
      now: at(42 * 60),
      creatures: WORM,
      tracking: oneMinute.tracking,
    });
    expect(twoMinutes.arrival).toBe('snail');
  });

  it('keeps the spacing after away time too', () => {
    const result = evaluate({
      now: at(10 * 60),
      creatures: creatures('worm'),
      tracking: { species: {}, lastArrivalAt: T0.toISOString() },
      away: true,
    });

    expect(result.arrival).toBeNull();
  });

  it('forgets metSince when the condition stops holding, so the delay starts over', () => {
    const met = evaluate({ now: T0, creatures: WORM });
    const gone = evaluate({
      now: at(60),
      creatures: WORM,
      garden: garden(blooms('clover', 3)),
      tracking: met.tracking,
    });
    expect(gone.tracking.species.snail).toEqual({ metSince: null });

    const back = evaluate({
      now: at(150),
      creatures: WORM,
      tracking: gone.tracking,
    });
    expect(back.arrival).toBeNull();
    expect(back.tracking.species.snail).toEqual({
      metSince: at(150).toISOString(),
    });
  });

  it('tracks every species, met or not', () => {
    const result = evaluate({ now: T0 });

    expect(Object.keys(result.tracking.species).sort()).toEqual(
      SPECIES.map((each) => each.id).sort(),
    );
    expect(result.tracking.species.bee).toEqual({ metSince: null });
  });
});
