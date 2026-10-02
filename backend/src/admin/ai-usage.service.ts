import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { AiUsage } from './ai-usage.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the AI gateway logs about one of its calls. */
export interface AiUsageEntry {
  feature: string;
  planetId: string | null;
  usedFallback: boolean;
  reason: string | null;
  latencyMs: number;
}

/**
 * The AI usage log: one row per gateway call, and today's count of the calls
 * the model answered, which the daily budget is checked against (D-12).
 */
@Injectable()
export class AiUsageService {
  constructor(
    @InjectRepository(AiUsage) private readonly usage: Repository<AiUsage>,
    private readonly clock: ClockService,
  ) {}

  /** Logs one gateway call, dated now. */
  async record(entry: AiUsageEntry): Promise<void> {
    await this.usage.insert({ ...entry, createdAt: this.clock.now() });
  }

  /** The gateway calls today (UTC) that the model answered, without a fallback. */
  countToday(): Promise<number> {
    const now = this.clock.now();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start.getTime() + DAY_MS);
    return this.usage.countBy({
      usedFallback: false,
      createdAt: And(MoreThanOrEqual(start), LessThan(end)),
    });
  }
}
