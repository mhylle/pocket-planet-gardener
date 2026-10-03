import { diaryDate } from './diary-date';

describe('diaryDate', () => {
  // Noon UTC, so the day is the same in every time zone the specs may run in.
  it.each([
    ['2026-10-02T12:00:00.000Z', 'Friday, 2 October'],
    ['2026-10-01T12:00:00.000Z', 'Thursday, 1 October'],
    ['2026-12-25T12:00:00.000Z', 'Friday, 25 December'],
  ])('heads the page of %s "%s" (JRN-01 AC2)', (iso, heading) => {
    expect(diaryDate(iso)).toBe(heading);
  });
});
