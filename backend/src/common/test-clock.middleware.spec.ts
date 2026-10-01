import { BadRequestException } from '@nestjs/common';
import { ClockService } from './clock.service';
import { TestClockMiddleware } from './test-clock.middleware';

/**
 * The middleware only needs ConfigService#get, so it is constructed directly
 * with a stub, as in game-config.service.spec.ts.
 */
function buildMiddleware(nodeEnv: string | undefined): TestClockMiddleware {
  const env: Record<string, string | undefined> = { NODE_ENV: nodeEnv };
  return new TestClockMiddleware({ get: (key: string) => env[key] } as never);
}

/**
 * Runs the middleware for a request with the given X-Test-Now value and
 * returns the time the rest of the request would see, or null when next()
 * was never called.
 */
function timeSeenDownstream(
  middleware: TestClockMiddleware,
  testNow?: string,
): Date | null {
  const clock = new ClockService();
  const headers = testNow === undefined ? {} : { 'x-test-now': testNow };
  let seen: Date | null = null;
  middleware.use({ headers } as never, {} as never, () => {
    seen = clock.now();
  });
  return seen;
}

function expectRealTime(seen: Date | null, before: number): void {
  expect(seen).not.toBeNull();
  expect(seen!.getTime()).toBeGreaterThanOrEqual(before);
  expect(seen!.getTime()).toBeLessThanOrEqual(Date.now());
}

describe('TestClockMiddleware', () => {
  describe.each(['development', 'production', undefined])(
    'when NODE_ENV is %p',
    (nodeEnv) => {
      const middleware = buildMiddleware(nodeEnv);

      it.each(['2030-01-01T00:00:00.000Z', 'banana'])(
        'ignores X-Test-Now: %s',
        (testNow) => {
          const before = Date.now();

          expectRealTime(timeSeenDownstream(middleware, testNow), before);
        },
      );
    },
  );

  describe('when NODE_ENV is test', () => {
    const middleware = buildMiddleware('test');

    it.each([
      ['2030-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z'],
      ['2030-01-01T00:00:00Z', '2030-01-01T00:00:00.000Z'],
      ['2030-01-01T01:30:00+01:30', '2030-01-01T00:00:00.000Z'],
    ])('runs the request at X-Test-Now: %s', (testNow, expected) => {
      expect(timeSeenDownstream(middleware, testNow)).toEqual(
        new Date(expected),
      );
    });

    it('uses the real time without the header', () => {
      const before = Date.now();

      expectRealTime(timeSeenDownstream(middleware), before);
    });

    it.each([
      'banana',
      '',
      '2030-01-01',
      '2030-01-01T00:00:00',
      '2030-13-01T00:00:00Z',
      '1893456000000',
    ])('rejects X-Test-Now: %p with 400', (testNow) => {
      let error: unknown;
      try {
        timeSeenDownstream(middleware, testNow);
      } catch (thrown) {
        error = thrown;
      }

      expect(error).toBeInstanceOf(BadRequestException);
      const rejection = error as BadRequestException;
      expect(rejection.getStatus()).toBe(400);
      expect(rejection.getResponse()).toMatchObject({
        message: 'X-Test-Now must be an ISO timestamp',
      });
    });
  });
});
