import { canMoveTo, TUTORIAL_FINISHED } from './tutorial-rules';

// Steps 0 to 7, as in content/tutorial.ts.
const LAST = 7;

describe('canMoveTo', () => {
  it.each([
    [0, 1],
    [0, 3],
    [3, 4],
    [6, LAST],
  ])('moves on from step %i to the later step %i', (current, next) => {
    expect(canMoveTo(current, next, LAST)).toBe(true);
  });

  it.each([
    [3, 2],
    [3, 3],
    [3, 0],
    [0, 0],
  ])('never goes back or stays, from step %i to %i', (current, next) => {
    expect(canMoveTo(current, next, LAST)).toBe(false);
  });

  it.each([LAST + 1, 9, -2])(
    'refuses step %i, which does not exist',
    (next) => {
      expect(canMoveTo(0, next, LAST)).toBe(false);
    },
  );

  it.each([0, 3, LAST, TUTORIAL_FINISHED])(
    'finishes from step %i',
    (current) => {
      expect(canMoveTo(current, TUTORIAL_FINISHED, LAST)).toBe(true);
    },
  );

  it('restarts a finished tutorial at the first step only', () => {
    expect(canMoveTo(TUTORIAL_FINISHED, 0, LAST)).toBe(true);
    expect(canMoveTo(TUTORIAL_FINISHED, 1, LAST)).toBe(false);
    expect(canMoveTo(TUTORIAL_FINISHED, 3, LAST)).toBe(false);
  });
});
