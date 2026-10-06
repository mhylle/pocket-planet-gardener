import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DEFAULT_PLAYER_SETTINGS, PlayerSettings } from '../models/player-settings';
import { ApiService } from './api.service';

export const SETTINGS_NOT_SAVED =
  "That change didn't save just now, so your settings are back as they were. Please try again in a moment.";

/**
 * The loaded planet's sound and motion settings (SET-01, SET-03), kept on the server so they
 * follow the player to any device (SET-01 AC2). A change applies at once and is saved; when the
 * save fails, the settings go back to what the server last confirmed, with a calm notice. Until
 * a planet's settings load, and once it closes, the defaults apply.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);
  private readonly current = signal<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);
  private readonly problem = signal<string | null>(null);
  /** What the server last confirmed; a failed save goes back to it. */
  private confirmed = DEFAULT_PLAYER_SETTINGS;
  /** Counts the saves, so only the latest one's answer counts. */
  private saves = 0;
  private requests = new Subscription();

  readonly settings = this.current.asReadonly();
  /** Why the last change was not kept; null when it was. */
  readonly notice = this.problem.asReadonly();

  /** Fetches the loaded planet's settings; on failure the defaults stay. */
  load(): void {
    this.requests.add(
      this.api.get<PlayerSettings>('/planet/settings').subscribe({
        next: (settings) => this.confirm(settings),
        error: () => {
          // The game plays on with the defaults.
        },
      }),
    );
  }

  /** Applies a change at once without saving it, such as while a slider is being dragged. */
  preview(change: Partial<PlayerSettings>): void {
    this.current.update((settings) => ({ ...settings, ...change }));
  }

  /** Applies a change at once and saves it. */
  update(change: Partial<PlayerSettings>): void {
    this.preview(change);
    this.problem.set(null);
    const save = ++this.saves;
    this.requests.add(
      this.api.patch<PlayerSettings>('/planet/settings', change).subscribe({
        next: (settings) => {
          if (save === this.saves) {
            this.confirm(settings);
          } else {
            this.confirmed = settings;
          }
        },
        error: () => {
          if (save === this.saves) {
            this.current.set(this.confirmed);
            this.problem.set(SETTINGS_NOT_SAVED);
          }
        },
      }),
    );
  }

  /** Forgets the planet's settings, such as when it closes; answers still on their way are dropped. */
  reset(): void {
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.confirm(DEFAULT_PLAYER_SETTINGS);
    this.problem.set(null);
  }

  private confirm(settings: PlayerSettings): void {
    this.confirmed = settings;
    this.current.set(settings);
  }
}
