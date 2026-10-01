import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/**
 * The single source of randomness. Inject it instead of calling Math.random,
 * so tests can substitute test/support/seeded-random.ts.
 */
@Injectable()
export class RandomService {
  /** A uniformly random integer between min and max, both inclusive. */
  int(min: number, max: number): number {
    return randomInt(min, max + 1);
  }

  /** A uniformly random element. Throws on an empty list. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list');
    }
    return items[this.int(0, items.length - 1)];
  }
}
