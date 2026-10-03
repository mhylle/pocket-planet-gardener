import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameConfigService } from '../game-config/game-config.service';
import type { JournalEntryDto } from '../journal/dto/journal-entry.dto';
import type { MutationContext } from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type { WelcomeBackDto } from './dto/welcome-back.dto';
import { EventLogService } from './event-log.service';
import { summarise, type SummaryLine } from './event-summary';

const MINUTE_MS = 60_000;

/** Writes the journal entry a sync is due, if any; JournalService registers one. */
export type JournalWriter = (
  ctx: MutationContext,
  previousLastSeenAt: Date,
) => Promise<JournalEntryDto | undefined>;

/**
 * What a returning player is told (TIM-03, JRN-01). Its sync contributor
 * adds welcomeBack to the sync's answer when the player has been away long
 * enough and something worth saying happened meanwhile, or the journal
 * wrote a new page.
 */
@Injectable()
export class ReturnService implements OnModuleInit {
  private journalWriter?: JournalWriter;

  constructor(
    private readonly planetState: PlanetStateService,
    private readonly eventLog: EventLogService,
    private readonly config: GameConfigService,
  ) {}

  onModuleInit(): void {
    this.planetState.registerSyncContributor((ctx, previousLastSeenAt) =>
      this.buildReturn(ctx, previousLastSeenAt),
    );
  }

  /** Lets JournalModule add its page without this module importing it. */
  registerJournalWriter(writer: JournalWriter): void {
    this.journalWriter = writer;
  }

  /**
   * The summary of the events since the player was last here, this sync's
   * catch-up included, after summaryAfterMinutes or more away (AC1), and the
   * journal entry when one is due. Nothing when neither has anything to say
   * (AC2); a quiet day's entry still comes, with an empty summary (JRN-02 AC3).
   */
  async buildReturn(
    ctx: MutationContext,
    previousLastSeenAt: Date,
  ): Promise<{ welcomeBack?: WelcomeBackDto }> {
    const summary = await this.summarySince(ctx, previousLastSeenAt);
    const journalEntry = await this.journalWriter?.(ctx, previousLastSeenAt);
    if (journalEntry) {
      return { welcomeBack: { summary, journalEntry } };
    }
    return summary.length > 0 ? { welcomeBack: { summary } } : {};
  }

  /** The news since previousLastSeenAt; [] after a shorter absence, without reading the log. */
  private async summarySince(
    ctx: MutationContext,
    previousLastSeenAt: Date,
  ): Promise<SummaryLine[]> {
    const away = ctx.now.getTime() - previousLastSeenAt.getTime();
    if (away < this.config.summaryAfterMinutes * MINUTE_MS) {
      return [];
    }
    const events = await this.eventLog.since(
      ctx.planet.id,
      previousLastSeenAt,
      ctx.em,
    );
    return summarise(events);
  }
}
