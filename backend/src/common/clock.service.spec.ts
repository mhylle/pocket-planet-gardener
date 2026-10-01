import { FakeClock } from '../../test/support/fake-clock';
import { ClockService } from './clock.service';

const testInstant = new Date('2030-01-01T00:00:00.000Z');

/** Asserts that now() read the real time between before and the call. */
function expectRealTime(now: Date, before: number): void {
  expect(now.getTime()).toBeGreaterThanOrEqual(before);
  expect(now.getTime()).toBeLessThanOrEqual(Date.now());
}

describe('ClockService', () => {
  const clock = new ClockService();

  it('returns the real time outside a test-time scope', () => {
    const before = Date.now();

    expectRealTime(clock.now(), before);
  });

  it('returns the scoped time inside runAt, also after an await', async () => {
    const seen = await ClockService.runAt(testInstant, async () => {
      const first = clock.now();
      await new Promise((resolve) => setImmediate(resolve));
      return [first, clock.now()];
    });

    expect(seen).toEqual([testInstant, testInstant]);
  });

  it('returns the real time again once the scope ends', () => {
    ClockService.runAt(testInstant, () => clock.now());
    const before = Date.now();

    expectRealTime(clock.now(), before);
  });

  it('returns a copy, so mutating it does not move the scoped time', () => {
    ClockService.runAt(testInstant, () => {
      clock.now().setFullYear(1999);

      expect(clock.now()).toEqual(testInstant);
    });
  });
});

describe('FakeClock', () => {
  it('fits wherever a ClockService is expected', () => {
    // Fails to compile under tsc if the public shapes drift apart.
    const clock: ClockService = new FakeClock(testInstant);

    expect(clock.now()).toEqual(testInstant);
  });

  it('stands still until advanced', () => {
    const clock = new FakeClock(testInstant);

    expect(clock.now()).toEqual(clock.now());
    clock.advance(90_000);
    expect(clock.now()).toEqual(new Date('2030-01-01T00:01:30.000Z'));
  });

  it('jumps to a set time', () => {
    const clock = new FakeClock();
    clock.set(new Date('2031-06-15T12:00:00.000Z'));

    expect(clock.now()).toEqual(new Date('2031-06-15T12:00:00.000Z'));
  });

  it('returns a copy, so mutating it does not move the clock', () => {
    const clock = new FakeClock(testInstant);
    clock.now().setFullYear(1999);

    expect(clock.now()).toEqual(testInstant);
  });
});
