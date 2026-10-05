import { BLOCKED_NAMES } from './blocked-names';
import type { ArrivalCondition } from './content.types';
import { DECORATIONS } from './decorations';
import { PLANTS } from './plants';
import { SPECIES } from './species';
import { STARTER_INVENTORY } from './starter';

/** Splits on sentence-ending punctuation followed by whitespace. */
function sentenceCount(text: string): number {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((part) => part.length > 0).length;
}

/** Every condition in the tree, including those nested inside an 'all'. */
function flatten(condition: ArrivalCondition): ArrivalCondition[] {
  return condition.kind === 'all'
    ? [condition, ...condition.of.flatMap(flatten)]
    : [condition];
}

const plantIds = PLANTS.map((plant) => plant.id);
const decorationIds = DECORATIONS.map((decoration) => decoration.id);
const speciesIds = SPECIES.map((species) => species.id);

describe('content', () => {
  it('has at least 8 plants, 5 decorations and 6 species', () => {
    expect(PLANTS.length).toBeGreaterThanOrEqual(8);
    expect(DECORATIONS.length).toBeGreaterThanOrEqual(5);
    expect(SPECIES.length).toBeGreaterThanOrEqual(6);
  });

  it.each([
    ['plant', plantIds],
    ['decoration', decorationIds],
    ['species', speciesIds],
  ])('has unique %s ids', (_label, ids) => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only existing plants and decorations in arrival conditions', () => {
    for (const species of SPECIES) {
      for (const condition of flatten(species.arrivalCondition)) {
        if (condition.kind === 'blooming') {
          expect(plantIds).toContain(condition.plant);
          expect(condition.count).toBeGreaterThan(0);
        }
        if (condition.kind === 'decoration') {
          expect(decorationIds).toContain(condition.decoration);
        }
        if (condition.kind === 'distinct-blooming') {
          expect(condition.count).toBeGreaterThan(0);
          expect(condition.count).toBeLessThanOrEqual(PLANTS.length);
        }
        if (condition.kind === 'all') {
          expect(condition.of.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('gives every plant a positive bloom time', () => {
    for (const plant of PLANTS) {
      expect(plant.bloomMinutes).toBeGreaterThan(0);
    }
  });

  it('gives every plant and decoration a short description and a hint', () => {
    expect(sentenceCount('One. Two! Three?')).toBe(3);
    for (const item of [...PLANTS, ...DECORATIONS]) {
      expect(item.description.trim()).not.toBe('');
      expect(sentenceCount(item.description)).toBeLessThanOrEqual(2);
      expect(item.unlockHint.trim()).not.toBe('');
    }
  });

  it('gives every decoration a positive footprint, a pond bigger than a rock', () => {
    for (const decoration of DECORATIONS) {
      expect(decoration.footprintSteps).toBeGreaterThan(0);
    }
    const footprint = (id: string) =>
      DECORATIONS.find((decoration) => decoration.id === id)?.footprintSteps;
    expect(footprint('pond')).toBeGreaterThan(footprint('rock') ?? Infinity);
  });

  it('has the pond as its only water', () => {
    const water = DECORATIONS.filter((decoration) => decoration.isWater);
    expect(water.map((decoration) => decoration.id)).toEqual(['pond']);
  });

  it('gives every species a name and a non-empty hint', () => {
    for (const species of SPECIES) {
      expect(species.name.trim()).not.toBe('');
      expect(species.hint.trim()).not.toBe('');
    }
  });

  describe('starter inventory', () => {
    const starterPlants = STARTER_INVENTORY.map((item) =>
      PLANTS.find((plant) => plant.id === item.itemType),
    );

    it('contains only plant seeds, no decorations, each with a positive count', () => {
      for (const item of STARTER_INVENTORY) {
        expect(plantIds).toContain(item.itemType);
        expect(Number.isInteger(item.count)).toBe(true);
        expect(item.count).toBeGreaterThan(0);
      }
    });

    it('has at least 3 distinct seed types', () => {
      const types = new Set(STARTER_INVENTORY.map((item) => item.itemType));
      expect(types.size).toBeGreaterThanOrEqual(3);
    });

    it('has a seed that blooms within 10 minutes, even with one need unmet (ONB-02 AC1)', () => {
      // An unmet need halves the speed (the SD default of 50%).
      const unmetNeedGrowthFactor = 0.5;
      expect(
        starterPlants.some(
          (plant) => plant && plant.bloomMinutes / unmetNeedGrowthFactor <= 10,
        ),
      ).toBe(true);
    });

    it('has enough clover for the snail condition', () => {
      const clover = STARTER_INVENTORY.find(
        (item) => item.itemType === 'clover',
      );
      expect(clover?.count).toBeGreaterThanOrEqual(3);
    });
  });

  it('lists blocked names in lowercase without duplicates', () => {
    expect(BLOCKED_NAMES.length).toBeGreaterThan(0);
    for (const name of BLOCKED_NAMES) {
      expect(name).toBe(name.toLowerCase().trim());
      expect(name).not.toBe('');
    }
    expect(new Set(BLOCKED_NAMES).size).toBe(BLOCKED_NAMES.length);
  });
});
