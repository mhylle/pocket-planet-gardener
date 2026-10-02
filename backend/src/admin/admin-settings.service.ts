import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { AdminSetting } from './admin-setting.entity';
import { AiUsageService } from './ai-usage.service';
import type { AdminSettingsDto } from './dto/admin-settings.dto';

/** The game-owner settings, each stored as one admin_settings row. */
export interface AdminSettings {
  aiEnabled: boolean;
  aiDailyBudget: number;
}

/** What applies while the game owner has not set a value. */
export const DEFAULT_ADMIN_SETTINGS: Readonly<AdminSettings> = {
  aiEnabled: true,
  // SD Q-8 leaves the daily AI budget to the game owner; this stands in
  // until they set one.
  aiDailyBudget: 1000,
};

// ADM-01 AC1: a switch made elsewhere reaches every request within a minute.
const CACHE_MS = 60_000;

/**
 * The AI switch and the daily AI budget (ADM-01, ADM-02). The AI gateway
 * reads them on every call, so they are cached for a minute; an update
 * through this service applies at once.
 */
@Injectable()
export class AdminSettingsService {
  private cache: { settings: AdminSettings; readAt: number } | null = null;

  constructor(
    @InjectRepository(AdminSetting)
    private readonly settings: Repository<AdminSetting>,
    private readonly usage: AiUsageService,
    private readonly clock: ClockService,
  ) {}

  async aiEnabled(): Promise<boolean> {
    return (await this.read()).aiEnabled;
  }

  async aiDailyBudget(): Promise<number> {
    return (await this.read()).aiDailyBudget;
  }

  /** The settings with today's AI use, as the admin view shows them. */
  async view(): Promise<AdminSettingsDto> {
    const settings = await this.read();
    return { ...settings, aiRequestsToday: await this.usage.countToday() };
  }

  /** Stores the given settings, leaves the others alone and drops the cache. */
  async update(changes: Partial<AdminSettings>): Promise<AdminSettingsDto> {
    const updatedAt = this.clock.now();
    const rows = Object.entries(changes)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({ key, value, updatedAt }));
    if (rows.length > 0) {
      await this.settings.save(rows);
    }
    this.cache = null;
    return this.view();
  }

  private async read(): Promise<AdminSettings> {
    const now = this.clock.now().getTime();
    if (this.cache) {
      // A cache read "in the future" is stale too: X-Test-Now moves the
      // clock both ways.
      const age = now - this.cache.readAt;
      if (age >= 0 && age < CACHE_MS) {
        return this.cache.settings;
      }
    }
    const stored = new Map(
      (await this.settings.find()).map((row) => [row.key, row.value]),
    );
    const aiEnabled = stored.get('aiEnabled');
    const aiDailyBudget = stored.get('aiDailyBudget');
    const settings: AdminSettings = {
      aiEnabled:
        typeof aiEnabled === 'boolean'
          ? aiEnabled
          : DEFAULT_ADMIN_SETTINGS.aiEnabled,
      aiDailyBudget:
        Number.isInteger(aiDailyBudget) && (aiDailyBudget as number) >= 0
          ? (aiDailyBudget as number)
          : DEFAULT_ADMIN_SETTINGS.aiDailyBudget,
    };
    this.cache = { settings, readAt: now };
    return settings;
  }
}
