import { checkText } from '../ai/content-rules';
import {
  WANT_LIMITS,
  WANT_TYPES,
  type WantAnchor,
  type WantSpec,
  type WantType,
} from '../wants/want-evaluator';
import { WANT_TEXT_LIMITS } from '../wants/want-prompt';
import { DECORATIONS } from './decorations';
import { FALLBACK_WANTS, fillWantTemplate } from './fallback-wants';
import { PLANTS } from './plants';
import { SPECIES } from './species';

/** Whole numbers from min to max. */
function range({ min, max }: { min: number; max: number }): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

const counts = range(WANT_LIMITS.count);
const anchors: WantAnchor[] = [
  { kind: 'home' },
  ...DECORATIONS.map((decoration) => ({
    kind: 'decoration' as const,
    decoration: decoration.id,
  })),
];

/** Every want of the type that any planet could fill a line with. */
function everySpec(type: WantType): WantSpec[] {
  switch (type) {
    case 'plant-near':
      return PLANTS.flatMap((plant) =>
        anchors.flatMap((near) =>
          counts.map((count) => ({
            type,
            plant: plant.id,
            count,
            near,
            withinSteps: 3,
          })),
        ),
      );
    case 'count-blooming':
      return PLANTS.flatMap((plant) =>
        counts.map((count) => ({ type, plant: plant.id, count })),
      );
    case 'place-decoration':
      return DECORATIONS.map((decoration) => ({
        type,
        decoration: decoration.id,
      }));
    case 'variety':
      return range(WANT_LIMITS.distinct).map((distinct) => ({
        type,
        distinct,
        withinSteps: 3,
      }));
    case 'bring-back':
      return [
        ...PLANTS.map((plant) => ({
          type,
          itemKind: 'plant' as const,
          item: plant.id,
        })),
        ...DECORATIONS.map((decoration) => ({
          type,
          itemKind: 'decoration' as const,
          item: decoration.id,
        })),
      ];
  }
}

/** The placeholders each type fills, and the one every line of it must use. */
const PLACEHOLDERS: Record<WantType, { allowed: string[]; required: string }> =
  {
    'plant-near': {
      allowed: ['amount', 'plant', 'plants', 'place'],
      required: 'place',
    },
    'count-blooming': {
      allowed: ['amount', 'plant', 'plants'],
      required: 'amount',
    },
    'place-decoration': { allowed: ['decoration'], required: 'decoration' },
    variety: { allowed: ['count'], required: 'count' },
    'bring-back': { allowed: ['item'], required: 'item' },
  };

/** Species that neither fly nor have wings (AIB-07 AC2). */
const WINGLESS = ['worm', 'snail', 'hedgehog', 'frog'] as const;

const speciesIds = SPECIES.map((species) => species.id);

describe('fallback wants', () => {
  it('has no species beyond the catalogue', () => {
    expect(Object.keys(FALLBACK_WANTS).sort()).toEqual([...speciesIds].sort());
  });

  it.each(speciesIds)(
    'has at least 3 lines for every want type for %s (WNT-02 AC5)',
    (species) => {
      expect(Object.keys(FALLBACK_WANTS[species]).sort()).toEqual(
        [...WANT_TYPES].sort(),
      );
      for (const type of WANT_TYPES) {
        expect(FALLBACK_WANTS[species][type].length).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it('uses only the placeholders its want type fills, and the one each needs', () => {
    for (const species of speciesIds) {
      for (const type of WANT_TYPES) {
        const { allowed, required } = PLACEHOLDERS[type];
        for (const line of FALLBACK_WANTS[species][type]) {
          const used = [...line.matchAll(/\{(\w+)\}/g)].map(([, key]) => key);
          expect({
            line,
            unknown: used.filter((key) => !allowed.includes(key)),
          }).toEqual({ line, unknown: [] });
          expect({ line, required: used.includes(required) }).toEqual({
            line,
            required: true,
          });
        }
      }
    }
  });

  it('passes the content rules for a want with every item it can be filled with (SD section 10)', () => {
    for (const species of speciesIds) {
      for (const type of WANT_TYPES) {
        for (const line of FALLBACK_WANTS[species][type]) {
          for (const spec of everySpec(type)) {
            const text = fillWantTemplate(line, spec);
            expect({
              text,
              violations: checkText(text, WANT_TEXT_LIMITS),
              unfilled: /[{}]/.test(text),
            }).toEqual({ text, violations: [], unfilled: false });
          }
        }
      }
    }
  });

  it('gives no wings to a species that has none (AIB-07 AC2)', () => {
    for (const species of WINGLESS) {
      const lines = Object.values(FALLBACK_WANTS[species]).flat();
      for (const line of lines) {
        expect(line).not.toMatch(/\b(wings?|fly|flying|flutter\w*)\b/i);
      }
    }
  });
});

describe('fillWantTemplate', () => {
  it("fills the SD's moth example", () => {
    expect(
      fillWantTemplate('One requires {plants}. Near {place}, obviously.', {
        type: 'plant-near',
        plant: 'moonflower',
        count: 2,
        near: { kind: 'decoration', decoration: 'lamp-post' },
        withinSteps: 3,
      }),
    ).toBe('One requires moonflowers. Near the lamp-post, obviously.');
  });

  it('writes the amount in words, singular for one and cacti for cactus', () => {
    const line = '{amount} in bloom, please.';
    expect(
      fillWantTemplate(line, {
        type: 'count-blooming',
        plant: 'clover',
        count: 1,
      }),
    ).toBe('One clover in bloom, please.');
    expect(
      fillWantTemplate(line, {
        type: 'count-blooming',
        plant: 'cactus',
        count: 3,
      }),
    ).toBe('Three cacti in bloom, please.');
  });

  it('starts every sentence with a capital, near home too', () => {
    expect(
      fillWantTemplate('Bzz! {amount} near {place}.', {
        type: 'plant-near',
        plant: 'tulip',
        count: 2,
        near: { kind: 'home' },
        withinSteps: 3,
      }),
    ).toBe('Bzz! Two tulips near my home.');
  });

  it('names decorations and bring-back items by their catalogue names', () => {
    expect(
      fillWantTemplate('A {decoration}, please.', {
        type: 'place-decoration',
        decoration: 'tiny-house',
      }),
    ).toBe('A tiny house, please.');
    expect(
      fillWantTemplate('I miss the {item}.', {
        type: 'bring-back',
        itemKind: 'decoration',
        item: 'pond',
      }),
    ).toBe('I miss the pond.');
    expect(
      fillWantTemplate('{count} different plants.', {
        type: 'variety',
        distinct: 4,
        withinSteps: 2,
      }),
    ).toBe('Four different plants.');
  });

  it('leaves a placeholder the want has no value for', () => {
    expect(
      fillWantTemplate('A {decoration}.', {
        type: 'variety',
        distinct: 2,
        withinSteps: 2,
      }),
    ).toBe('A {decoration}.');
  });
});
