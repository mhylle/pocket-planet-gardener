import { humanDuration } from './human-duration';

describe('humanDuration', () => {
  it.each([
    [1, 'about 5 minutes'],
    [8, 'about 10 minutes'],
    [45, 'about 45 minutes'],
    [56, 'about 55 minutes'],
    [58, 'about 1 hour'],
    [60, 'about 1 hour'],
    [75, 'about 1½ hours'],
    [90, 'about 1½ hours'],
    [120, 'about 2 hours'],
    [150, 'about 2½ hours'],
    [180, 'about 3 hours'],
  ])('says %i minutes as "%s" (GRD-05 AC2)', (minutes, words) => {
    expect(humanDuration(minutes)).toBe(words);
  });
});
