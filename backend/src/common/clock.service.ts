import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * The single source of the current time (D-11). Inject it instead of calling
 * the Date constructor, so tests can fix the time: unit tests substitute
 * test/support/fake-clock.ts, and e2e tests send X-Test-Now, which
 * TestClockMiddleware turns into a per-request time.
 */
@Injectable()
export class ClockService {
  // The test time of the current request, if TestClockMiddleware set one.
  // Static, so the instance shape stays just now() and FakeClock fits it.
  private static readonly testTime = new AsyncLocalStorage<Date>();

  /** Runs fn, and everything it awaits, with now() fixed at the given time. */
  static runAt<T>(at: Date, fn: () => T): T {
    return ClockService.testTime.run(at, fn);
  }

  now(): Date {
    const fixed = ClockService.testTime.getStore();
    // A copy, so a caller mutating the result cannot shift the request's time.
    return fixed ? new Date(fixed) : new Date();
  }
}
