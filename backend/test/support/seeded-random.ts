import { RandomService } from '../../src/common/random.service';

/**
 * A stand-in for RandomService whose draws repeat for the same seed. Only
 * int() is replaced; pick() is inherited and draws through it.
 */
export class SeededRandom extends RandomService {
  private state: number;

  constructor(seed = 1) {
    super();
    this.state = seed >>> 0;
  }

  override int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** mulberry32: a small, fast 32-bit generator, uniform in [0, 1). */
  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
