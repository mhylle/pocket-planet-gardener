import { checkText } from '../ai/content-rules';
import { identityProblems, identityTexts } from '../creatures/identity-prompt';
import { FALLBACK_IDENTITIES } from './fallback-identities';
import { SPECIES } from './species';

const all = Object.values(FALLBACK_IDENTITIES).flat();

/** Species that neither fly nor have wings (AIB-07 AC2). */
const WINGLESS = ['worm', 'snail', 'hedgehog', 'frog'] as const;

describe('fallback identities', () => {
  it.each(SPECIES.map((species) => species.id))(
    'has at least 10 for %s (AIB-05)',
    (species) => {
      expect(FALLBACK_IDENTITIES[species].length).toBeGreaterThanOrEqual(10);
    },
  );

  it('has no species beyond the catalogue', () => {
    expect(Object.keys(FALLBACK_IDENTITIES).sort()).toEqual(
      SPECIES.map((species) => species.id).sort(),
    );
  });

  it('uses each name once across the whole pool, ignoring case', () => {
    const names = all.map((identity) => identity.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every identity its own quirk, backstory and summary', () => {
    for (const field of ['quirk', 'backstory', 'summary'] as const) {
      const texts = all.map((identity) => identity[field]);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('keeps every identity to the identity rules and limits', () => {
    for (const identity of all) {
      expect({
        name: identity.name,
        problems: identityProblems(identity, []),
      }).toEqual({ name: identity.name, problems: [] });
    }
  });

  it('passes every text through the content rules (SD section 10)', () => {
    for (const identity of all) {
      for (const text of identityTexts(identity)) {
        expect({ text, violations: checkText(text) }).toEqual({
          text,
          violations: [],
        });
      }
    }
  });

  it('gives no wings to a species that has none (AIB-07 AC2)', () => {
    for (const species of WINGLESS) {
      for (const identity of FALLBACK_IDENTITIES[species]) {
        expect(identityTexts(identity).join(' ')).not.toMatch(/\bwings?\b/i);
      }
    }
  });
});
