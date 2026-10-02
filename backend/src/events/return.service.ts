import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameConfigService } from '../game-config/game-config.service';
import type { MutationContext } from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type { WelcomeBackDto } from './dto/welcome-back.dto';
import { EventLogService } from './event-log.service';
import { summarise } from './event-summary';

const MINUTE_MS = 60_000;

/**
 * What a returning player is told (TIM-03). Its sync contributor adds
 * welcomeBack to the sync's answer when the player has been away long enough
 * and something worth saying happened meanwhile.
 */
@Injectable()
export class ReturnService implements OnModuleInit {
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

  /**
   * The summary of the events since the player was last here, this sync's
   * catch-up included, after summaryAfterMinutes or more away (AC1). Nothing
   * after a shorter absence, or when nothing worth saying happened (AC2).
   */
  async buildReturn(
    ctx: MutationContext,
    previousLastSeenAt: Date,
  ): Promise<{ welcomeBack?: WelcomeBackDto }> {
    const away = ctx.now.getTime() - previousLastSeenAt.getTime();
    if (away < this.config.summaryAfterMinutes * MINUTE_MS) {
      return {};
    }
    const events = await this.eventLog.since(
      ctx.planet.id,
      previousLastSeenAt,
      ctx.em,
    );
    const summary = summarise(events);
    return summary.length > 0 ? { welcomeBack: { summary } } : {};
  }
}
