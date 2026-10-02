import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicGameConfigDto } from './dto/public-game-config.dto';

/**
 * The tunable parameters of SD section 11. Each is read once from its
 * GAME_* variable and falls back to the SD default when that variable is
 * unset, empty or not a number, so a play-tester can change one without
 * touching the code.
 */
@Injectable()
export class GameConfigService {
  // Garden
  readonly maxPlants: number;
  readonly cloudRefillSeconds: number;
  // Not in the SD table: the clouds and their rain (Task 7.2).
  readonly cloudCount: number;
  readonly cloudDriftDegreesPerMinute: number;
  readonly rainSeconds: number;
  readonly rainRadiusSteps: number;
  readonly rainWaterPerSecond: number;
  readonly sunOverrideMinutes: number;
  // Not in the SD table: how long the sun takes to drift once round (Task 6.1).
  readonly sunDayMinutes: number;
  readonly unmetNeedGrowthFactor: number;
  readonly seedsPerHarvestMin: number;
  readonly seedsPerHarvestMax: number;
  readonly harvestCooldownMinutes: number;
  readonly starterSeedTypes: number;

  // Creatures and wants
  readonly arrivalDelaySeconds: number;
  readonly arrivalSpacingMinutes: number;
  readonly maxCreatures: number;
  readonly maxPerSpecies: number;
  readonly overjoyedGiftHours: number;
  readonly wantCooldownMinutes: number;
  readonly unlockEveryNRewards: number;

  // Chat and AI
  readonly chatMessageMaxChars: number;
  readonly chatAnswerMaxWords: number;
  readonly aiTimeoutMs: number;
  readonly chatDailyLimit: number;

  // Time away and journal
  readonly maxAwayDays: number;
  readonly summaryAfterMinutes: number;
  readonly journalAfterHours: number;
  readonly journalMaxWords: number;

  // Client and planet
  readonly syncIntervalSeconds: number;
  readonly planetNameMin: number;
  readonly planetNameMax: number;

  // Not a tunable: where a wellbeing notice points to (AIB-03 AC2), from
  // SUPPORT_URL. Server-only; the client gets it on the notice itself.
  readonly supportUrl: string;

  constructor(config: ConfigService) {
    const read = (key: string, fallback: number): number => {
      const raw = config.get<string>(key)?.trim();
      const value = raw ? Number(raw) : NaN;
      return Number.isFinite(value) ? value : fallback;
    };

    this.maxPlants = read('GAME_MAX_PLANTS', 60);
    this.cloudRefillSeconds = read('GAME_CLOUD_REFILL_SECONDS', 60);
    this.cloudCount = read('GAME_CLOUD_COUNT', 3);
    this.cloudDriftDegreesPerMinute = read(
      'GAME_CLOUD_DRIFT_DEGREES_PER_MINUTE',
      6,
    );
    this.rainSeconds = read('GAME_RAIN_SECONDS', 8);
    this.rainRadiusSteps = read('GAME_RAIN_RADIUS_STEPS', 2);
    this.rainWaterPerSecond = read('GAME_RAIN_WATER_PER_SECOND', 0.15);
    this.sunOverrideMinutes = read('GAME_SUN_OVERRIDE_MINUTES', 5);
    this.sunDayMinutes = read('GAME_SUN_DAY_MINUTES', 60);
    this.unmetNeedGrowthFactor = read('GAME_UNMET_NEED_GROWTH_FACTOR', 0.5);
    this.seedsPerHarvestMin = read('GAME_SEEDS_PER_HARVEST_MIN', 1);
    this.seedsPerHarvestMax = read('GAME_SEEDS_PER_HARVEST_MAX', 2);
    this.harvestCooldownMinutes = read('GAME_HARVEST_COOLDOWN_MINUTES', 60);
    this.starterSeedTypes = read('GAME_STARTER_SEED_TYPES', 3);

    this.arrivalDelaySeconds = read('GAME_ARRIVAL_DELAY_SECONDS', 120);
    this.arrivalSpacingMinutes = read('GAME_ARRIVAL_SPACING_MINUTES', 30);
    this.maxCreatures = read('GAME_MAX_CREATURES', 8);
    this.maxPerSpecies = read('GAME_MAX_PER_SPECIES', 2);
    this.overjoyedGiftHours = read('GAME_OVERJOYED_GIFT_HOURS', 24);
    this.wantCooldownMinutes = read('GAME_WANT_COOLDOWN_MINUTES', 60);
    this.unlockEveryNRewards = read('GAME_UNLOCK_EVERY_N_REWARDS', 3);

    this.chatMessageMaxChars = read('GAME_CHAT_MESSAGE_MAX_CHARS', 200);
    this.chatAnswerMaxWords = read('GAME_CHAT_ANSWER_MAX_WORDS', 60);
    this.aiTimeoutMs = read('GAME_AI_TIMEOUT_MS', 15000);
    this.chatDailyLimit = read('GAME_CHAT_DAILY_LIMIT', 30);

    this.maxAwayDays = read('GAME_MAX_AWAY_DAYS', 7);
    this.summaryAfterMinutes = read('GAME_SUMMARY_AFTER_MINUTES', 60);
    this.journalAfterHours = read('GAME_JOURNAL_AFTER_HOURS', 4);
    this.journalMaxWords = read('GAME_JOURNAL_MAX_WORDS', 150);

    this.syncIntervalSeconds = read('GAME_SYNC_INTERVAL_SECONDS', 10);
    this.planetNameMin = read('GAME_PLANET_NAME_MIN', 2);
    this.planetNameMax = read('GAME_PLANET_NAME_MAX', 24);

    this.supportUrl =
      config.get<string>('SUPPORT_URL')?.trim() || 'https://findahelpline.com';
  }

  /**
   * The client-relevant subset served by GET /api/config. Server-only values
   * such as aiTimeoutMs stay out.
   */
  publicConfig(): PublicGameConfigDto {
    return {
      planetNameMin: this.planetNameMin,
      planetNameMax: this.planetNameMax,
      maxPlants: this.maxPlants,
      maxCreatures: this.maxCreatures,
      chatMessageMaxChars: this.chatMessageMaxChars,
      chatDailyLimit: this.chatDailyLimit,
      syncIntervalSeconds: this.syncIntervalSeconds,
      cloudRefillSeconds: this.cloudRefillSeconds,
      cloudDriftDegreesPerMinute: this.cloudDriftDegreesPerMinute,
      rainSeconds: this.rainSeconds,
      rainRadiusSteps: this.rainRadiusSteps,
      sunOverrideMinutes: this.sunOverrideMinutes,
      sunDayMinutes: this.sunDayMinutes,
      summaryAfterMinutes: this.summaryAfterMinutes,
      journalAfterHours: this.journalAfterHours,
    };
  }
}
