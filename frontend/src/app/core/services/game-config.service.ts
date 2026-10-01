import { Injectable, inject, signal } from '@angular/core';
import { DEFAULT_GAME_CONFIG, GameConfig } from '../models/game-config';
import { ApiService } from './api.service';

/** The game tunables, fetched once at startup. */
@Injectable({ providedIn: 'root' })
export class GameConfigService {
  private readonly api = inject(ApiService);
  private readonly current = signal<GameConfig>(DEFAULT_GAME_CONFIG);

  readonly config = this.current.asReadonly();

  /** Replaces the defaults with the server's values; on failure the defaults stay. */
  load(): void {
    this.api.get<GameConfig>('/config').subscribe({
      next: (config) => this.current.set(config),
      error: () => {
        // The game still runs on the defaults.
      },
    });
  }
}
