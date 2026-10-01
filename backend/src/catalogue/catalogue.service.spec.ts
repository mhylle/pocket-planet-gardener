import { DECORATIONS } from '../content/decorations';
import { PLANTS } from '../content/plants';
import { SPECIES } from '../content/species';
import { CatalogueService } from './catalogue.service';

const plantKeys = [
  'id',
  'name',
  'waterPref',
  'lightPref',
  'bloomMinutes',
  'description',
  'unlockHint',
];
const decorationKeys = [
  'id',
  'name',
  'footprintSteps',
  'description',
  'unlockHint',
];
const speciesKeys = ['id', 'name', 'hint'];

describe('CatalogueService', () => {
  const catalogue = new CatalogueService().catalogue();

  it('serves only the three lists', () => {
    expect(Object.keys(catalogue).sort()).toEqual([
      'decorations',
      'plants',
      'species',
    ]);
  });

  it('lists every content entry in content order', () => {
    expect(catalogue.plants).toHaveLength(PLANTS.length);
    expect(catalogue.decorations).toHaveLength(DECORATIONS.length);
    expect(catalogue.species).toHaveLength(SPECIES.length);

    expect(catalogue.plants.map((p) => p.id)).toEqual(PLANTS.map((p) => p.id));
    expect(catalogue.decorations.map((d) => d.id)).toEqual(
      DECORATIONS.map((d) => d.id),
    );
    expect(catalogue.species.map((s) => s.id)).toEqual(
      SPECIES.map((s) => s.id),
    );
  });

  it('gives every plant its needs and bloom time (GRD-05 AC2)', () => {
    catalogue.plants.forEach((plant, i) => {
      expect(plant).toMatchObject({
        bloomMinutes: PLANTS[i].bloomMinutes,
        waterPref: PLANTS[i].waterPref,
        lightPref: PLANTS[i].lightPref,
      });
    });
  });

  it('gives every species its hint but not its arrival condition', () => {
    catalogue.species.forEach((species, i) => {
      expect(species.hint).toBe(SPECIES[i].hint);
      expect(species).not.toHaveProperty('arrivalCondition');
    });
  });

  it.each([
    ['plants', plantKeys],
    ['decorations', decorationKeys],
    ['species', speciesKeys],
  ] as const)('gives %s exactly the public keys', (list, keys) => {
    for (const entry of catalogue[list]) {
      expect(Object.keys(entry).sort()).toEqual([...keys].sort());
    }
  });

  it('copies each public value from the content unchanged', () => {
    expectCopied(catalogue.plants, PLANTS);
    expectCopied(catalogue.decorations, DECORATIONS);
    expectCopied(catalogue.species, SPECIES);
  });
});

/** Every value the catalogue serves equals the same field of its content entry. */
function expectCopied(served: readonly object[], source: readonly object[]) {
  served.forEach((entry, i) => {
    const original = source[i] as Record<string, unknown>;
    for (const [key, value] of Object.entries(entry)) {
      expect(value).toBe(original[key]);
    }
  });
}
