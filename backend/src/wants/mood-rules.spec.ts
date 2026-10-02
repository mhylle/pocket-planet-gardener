import { FakeClock } from '../../test/support/fake-clock';
import type { ArrivalCondition } from '../content/content.types';
import { SPECIES } from '../content/species';
import { gardenView } from '../creatures/arrival-conditions';
import {
  giftDueAt,
  isWantDue,
  isWistful,
  missingItem,
  raiseMood,
} from './mood-rules';

const HOUR_MS = 3_600_000;

const SNAIL = SPECIES.find(
  (species) => species.id === 'snail',
)!.arrivalCondition;
const WORM = SPECIES.find((species) => species.id === 'worm')!.arrivalCondition;

const blooms = (type: 'clover' | 'mushroom', n: number) =>
  Array.from({ length: n }, () => ({ type, stage: 'bloom' }));
const sprout = (type: 'clover') => ({ type, stage: 'sprout' });
const POND = { type: 'pond' as const };

describe('mood rules', () => {
  describe('raiseMood (CRT-04 AC1)', () => {
    it('lifts content to cheerful and cheerful to overjoyed', () => {
      expect(raiseMood('content')).toBe('cheerful');
      expect(raiseMood('cheerful')).toBe('overjoyed');
    });

    it('caps at overjoyed', () => {
      expect(raiseMood('overjoyed')).toBe('overjoyed');
    });
  });

  describe('giftDueAt (CRT-04 AC2)', () => {
    it('falls overjoyedGiftHours after the creature became overjoyed', () => {
      const clock = new FakeClock();
      const since = clock.now();
      const due = giftDueAt(since, 24);

      clock.advance(23 * HOUR_MS);
      expect(due > clock.now()).toBe(true);
      clock.advance(HOUR_MS);
      expect(due <= clock.now()).toBe(true);
    });
  });

  describe('isWistful (CRT-04 AC3)', () => {
    it('is false while the snail has 3 blooming clovers and a pond', () => {
      expect(isWistful(SNAIL, gardenView(blooms('clover', 3), [POND]))).toBe(
        false,
      );
    });

    it('is true once the pond is gone', () => {
      expect(isWistful(SNAIL, gardenView(blooms('clover', 3), []))).toBe(true);
    });

    it('is true for the worm once nothing blooms', () => {
      expect(isWistful(WORM, gardenView([sprout('clover')], []))).toBe(true);
    });
  });

  describe('missingItem (CRT-04 AC3)', () => {
    const missing = (
      condition: ArrivalCondition,
      plants: { type: 'clover' | 'mushroom'; stage: string }[],
      decorations: { type: 'pond' }[],
    ) =>
      missingItem(
        condition,
        gardenView(plants, decorations),
        new Set(plants.map((plant) => plant.type)),
      );

    it('asks for the pond back when it was removed', () => {
      expect(missing(SNAIL, blooms('clover', 3), [])).toEqual({
        itemKind: 'decoration',
        item: 'pond',
      });
    });

    it('asks for the pond before the clover when both are gone', () => {
      expect(missing(SNAIL, [], [])).toEqual({
        itemKind: 'decoration',
        item: 'pond',
      });
    });

    it('asks for clover back when none is left at all', () => {
      expect(missing(SNAIL, blooms('mushroom', 3), [POND])).toEqual({
        itemKind: 'plant',
        item: 'clover',
      });
    });

    it('asks for nothing while some clover is still growing', () => {
      expect(
        missing(SNAIL, [...blooms('clover', 2), sprout('clover')], [POND]),
      ).toBeUndefined();
    });

    it('asks for nothing specific for a first bloom', () => {
      expect(missing(WORM, [], [])).toBeUndefined();
    });

    it('asks for nothing when the condition holds', () => {
      expect(missing(SNAIL, blooms('clover', 3), [POND])).toBeUndefined();
    });
  });

  describe('isWantDue (WNT-01 AC1, WNT-05 AC1)', () => {
    const clock = new FakeClock();
    const t0 = clock.now();
    const at = (hours: number) => new Date(t0.getTime() + hours * HOUR_MS);

    it('gives a creature that never had a want its first at once (ONB-02 AC3)', () => {
      expect(isWantDue([], t0, 60)).toBe(true);
    });

    it('gives none while a want is active, however old (WNT-05 AC3)', () => {
      const wants = [{ status: 'active' as const, resolvedAt: null }];
      expect(isWantDue(wants, at(30 * 24), 60)).toBe(false);
    });

    it('waits the cooldown after the last want was resolved', () => {
      const wants = [
        { status: 'fulfilled' as const, resolvedAt: at(-5) },
        { status: 'dismissed' as const, resolvedAt: t0 },
      ];
      expect(isWantDue(wants, at(59 / 60), 60)).toBe(false);
      expect(isWantDue(wants, at(1), 60)).toBe(true);
    });
  });
});
