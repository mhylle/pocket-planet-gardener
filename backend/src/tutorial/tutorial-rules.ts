/** The step of a planet that has finished or skipped the tutorial. */
export const TUTORIAL_FINISHED = -1;

/**
 * Whether a planet at step current may move to step next: on to a later
 * step, up to lastStep (ONB-01 AC2); to finished from anywhere (AC3); and
 * from finished only back to the first step, when Pip's help button
 * restarts the tutorial.
 */
export function canMoveTo(
  current: number,
  next: number,
  lastStep: number,
): boolean {
  if (next === TUTORIAL_FINISHED) {
    return true;
  }
  if (current === TUTORIAL_FINISHED) {
    return next === 0;
  }
  return next > current && next <= lastStep;
}
