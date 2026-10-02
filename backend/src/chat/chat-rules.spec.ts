import {
  isHighlightTurn,
  messageLength,
  nextStamp,
  parseAnswer,
  remainingToday,
  startOfUtcDay,
} from './chat-rules';

describe('chat rules', () => {
  it('counts the day from midnight UTC, whatever the offset of the clock', () => {
    expect(startOfUtcDay(new Date('2030-01-01T23:59:59.999Z'))).toEqual(
      new Date('2030-01-01T00:00:00.000Z'),
    );
    expect(startOfUtcDay(new Date('2030-01-02T00:30:00+02:00'))).toEqual(
      new Date('2030-01-01T00:00:00.000Z'),
    );
  });

  it.each([
    [30, 0, 30],
    [30, 29, 1],
    [30, 30, 0],
    [30, 31, 0],
  ])('leaves %p - %p = %p messages, never below 0', (limit, used, left) => {
    expect(remainingToday(limit, used)).toBe(left);
  });

  it('stamps a line at now when now is later than the previous line', () => {
    const now = new Date('2030-01-01T00:00:01.000Z');

    expect(nextStamp(now)).toEqual(now);
    expect(nextStamp(now, new Date('2030-01-01T00:00:00.000Z'))).toEqual(now);
  });

  it('stamps a line 1 ms after the previous one when the clock has not moved on', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');

    expect(nextStamp(now, now)).toEqual(new Date('2030-01-01T00:00:00.001Z'));
    expect(nextStamp(now, new Date('2030-01-01T00:00:05.000Z'))).toEqual(
      new Date('2030-01-01T00:00:05.001Z'),
    );
  });

  it('counts characters as code points, so an emoji is one', () => {
    expect(messageLength('hello')).toBe(5);
    expect(messageLength('🌻🌻')).toBe(2);
    expect(messageLength('x'.repeat(201))).toBe(201);
  });

  it('is due a highlight at every 5th message', () => {
    expect([0, 1, 4, 5, 6, 9, 10, 15].filter(isHighlightTurn)).toEqual([
      5, 10, 15,
    ]);
  });

  it('reads the answer as the trimmed reply, refusing an empty or overlong one', () => {
    expect(parseAnswer('  Hello, friend!\n')).toBe('Hello, friend!');
    expect(parseAnswer('   ')).toBeNull();
    expect(parseAnswer('a'.repeat(1201))).toBeNull();
  });
});
