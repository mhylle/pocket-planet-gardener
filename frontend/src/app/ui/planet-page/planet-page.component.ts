import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { PlanetService } from '../../core/services/planet.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SyncService } from '../../core/services/sync.service';
import { ReloadBannerComponent } from '../reload-banner/reload-banner.component';
import { SaveIndicatorComponent } from '../save-indicator/save-indicator.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';

/**
 * The planet screen. Loads the stored planet when it is not known yet (startup, or after
 * opening by code) and keeps it in sync while it is shown. The 3D view replaces the
 * placeholder in a later phase.
 */
@Component({
  selector: 'app-planet-page',
  imports: [ReloadBannerComponent, SaveIndicatorComponent, SettingsPanelComponent],
  templateUrl: './planet-page.component.html',
  styleUrl: './planet-page.component.scss',
})
export class PlanetPageComponent {
  private readonly planets = inject(PlanetService);
  private readonly sync = inject(SyncService);

  protected readonly planet = inject(PlanetStore).snapshot;
  protected readonly loadFailed = signal(false);
  protected readonly settingsOpen = signal(false);
  private readonly loaded = computed(() => this.planet() !== null);

  constructor() {
    if (!this.planet()) {
      void this.load();
    }
    // The cleanup also runs when the page closes, so the heartbeat never outlives it.
    effect((onCleanup) => {
      if (this.loaded()) {
        untracked(() => this.sync.startHeartbeat());
        onCleanup(() => this.sync.stopHeartbeat());
      }
    });
  }

  protected async load(): Promise<void> {
    this.loadFailed.set(false);
    try {
      await this.planets.load();
    } catch {
      this.loadFailed.set(true);
    }
  }
}
