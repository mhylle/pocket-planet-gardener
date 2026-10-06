import {
  PLANET_VISIBLE_MARK,
  TIME_TO_PLANET_MEASURE,
  markPlanetVisible,
  perfMode,
} from './perf';

describe('perf', () => {
  beforeEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  it('is on only with perf=1 in the query', () => {
    expect(perfMode('?perf=1')).toBe(true);
    expect(perfMode('?admin=1&perf=1')).toBe(true);
    expect(perfMode('')).toBe(false);
    expect(perfMode('?perf=0')).toBe(false);
    expect(perfMode('?perf=yes')).toBe(false);
  });

  it('marks the planet visible and measures it from the start of the page load (NFR-03)', () => {
    const lines: string[] = [];

    markPlanetVisible(performance, (line) => lines.push(line));

    const [mark] = performance.getEntriesByName(PLANET_VISIBLE_MARK, 'mark');
    const [measure] = performance.getEntriesByName(TIME_TO_PLANET_MEASURE, 'measure');
    expect(measure.startTime).toBe(0);
    expect(measure.duration).toBeCloseTo(mark.startTime, 6);
    expect(lines).toEqual([`[ppg perf] planet visible after ${Math.round(mark.startTime)} ms`]);
  });

  it('marks only the first time in a page load, and logs nothing without a log', () => {
    const lines: string[] = [];

    markPlanetVisible(performance);
    markPlanetVisible(performance, (line) => lines.push(line));

    expect(performance.getEntriesByName(PLANET_VISIBLE_MARK)).toHaveLength(1);
    expect(performance.getEntriesByName(TIME_TO_PLANET_MEASURE)).toHaveLength(1);
    expect(lines).toEqual([]);
  });
});
