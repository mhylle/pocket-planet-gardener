import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { PlanetService } from '../../core/services/planet.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SyncService } from '../../core/services/sync.service';
import { PlanetViewComponent } from '../../scene/planet-view/planet-view.component';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { LoadingComponent } from '../loading/loading.component';
import { ReloadBannerComponent } from '../reload-banner/reload-banner.component';
import { SaveIndicatorComponent } from '../save-indicator/save-indicator.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';

/**
 * The planet screen: the 3D planet with the planet's name, save state and settings around it.
 * Loads the stored planet when it is not known yet (startup, or after opening by code) and
 * keeps it in sync while it is shown. Pip shows until the planet is loaded and first drawn
 * (NFR-03). The page owns the 3D scene, so every panel on it can reach the scene services.
 */
@Component({
  selector: 'app-planet-page',
  imports: [
    LoadingComponent,
    PlanetViewComponent,
    ReloadBannerComponent,
    SaveIndicatorComponent,
    SettingsPanelComponent,
  ],
  providers: [SCENE_PROVIDERS],
  templateUrl: './planet-page.component.html',
  styleUrl: './planet-page.component.scss',
})
export class PlanetPageComponent {
  private readonly planets = inject(PlanetService);
  private readonly sync = inject(SyncService);

  protected readonly planet = inject(PlanetStore).snapshot;
  protected readonly sceneReady = inject(SceneService).ready;
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
