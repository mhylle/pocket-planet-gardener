/**
 * A stand-in for ClockService that only moves when told to. It has the same
 * public shape, so it fits wherever a ClockService is injected.
 */
export class FakeClock {
  private current: Date;

  constructor(start = new Date('2030-01-01T00:00:00.000Z')) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(at: Date): void {
    this.current = new Date(at);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
