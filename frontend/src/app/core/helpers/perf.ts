/** What every developer's performance line in the console starts with. */
export const PERF_PREFIX = '[ppg perf]';
/** The mark set when a returning player's planet is first drawn (NFR-03). */
export const PLANET_VISIBLE_MARK = 'ppg:planet-visible';
/** The measure from the start of the page load to that mark. */
export const TIME_TO_PLANET_MEASURE = 'ppg:time-to-planet';

/** True when the page was opened with ?perf=1, which turns on the performance lines. */
export function perfMode(search: string): boolean {
  return new URLSearchParams(search).get('perf') === '1';
}

/**
 * Marks the moment a returning player's planet is first drawn (NFR-03), with a measure from the
 * start of the page load; only once per page load. With a log, it also says how long that took,
 * such as "[ppg perf] planet visible after 1234 ms".
 */
export function markPlanetVisible(
  timing: Pick<Performance, 'mark' | 'measure' | 'getEntriesByName'>,
  log?: (line: string) => void,
): void {
  if (timing.getEntriesByName(PLANET_VISIBLE_MARK, 'mark').length > 0) {
    return;
  }
  timing.mark(PLANET_VISIBLE_MARK);
  // Time 0 is the time origin: the start of the navigation that opened the page.
  const { duration } = timing.measure(TIME_TO_PLANET_MEASURE, {
    start: 0,
    end: PLANET_VISIBLE_MARK,
  });
  log?.(`${PERF_PREFIX} planet visible after ${Math.round(duration)} ms`);
}
