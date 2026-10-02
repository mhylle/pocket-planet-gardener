import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CatalogueService } from '../../core/services/catalogue.service';
import { CelebrationService } from '../../core/services/celebration.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetService } from '../../core/services/planet.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { RewardRevealService } from '../../core/services/reward-reveal.service';
import { SyncService } from '../../core/services/sync.service';
import { CloudDragController } from '../../scene/cloud-drag.controller';
import { CreatureMeshService } from '../../scene/creature-mesh.service';
import { DecorationMeshService } from '../../scene/decoration-mesh.service';
import { GardenInputService } from '../../scene/garden-input.service';
import { PlacementGhostService } from '../../scene/placement-ghost.service';
import { PlantMeshService } from '../../scene/plant-mesh.service';
import { PlanetViewComponent } from '../../scene/planet-view/planet-view.component';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { SkyService } from '../../scene/sky.service';
import { SunDragController } from '../../scene/sun-drag.controller';
import { CatalogueComponent } from '../catalogue/catalogue.component';
import { CelebrationComponent } from '../celebration/celebration.component';
import { InfoCardComponent } from '../info-card/info-card.component';
import { InventoryPanelComponent } from '../inventory-panel/inventory-panel.component';
import { LoadingComponent } from '../loading/loading.component';
import { PlacementHudComponent } from '../placement-hud/placement-hud.component';
import { ReceiptToastComponent } from '../receipt-toast/receipt-toast.component';
import { ReloadBannerComponent } from '../reload-banner/reload-banner.component';
import { RewardRevealComponent } from '../reward-reveal/reward-reveal.component';
import { SaveIndicatorComponent } from '../save-indicator/save-indicator.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';
import { SkyListComponent } from '../sky-list/sky-list.component';
import { WelcomeBackComponent } from '../welcome-back/welcome-back.component';

/**
 * The planet screen: the 3D planet with its sky, the planet's name, save state, inventory,
 * catalogue and settings around it, and what changed for a returning player. Loads the stored
 * planet when it is not known yet (startup, or after opening by code) and keeps it in sync
 * while it is shown. Pip shows until the planet is loaded and first drawn (NFR-03). The page
 * owns the 3D scene and the gardening state, so every panel on it can reach them.
 */
@Component({
  selector: 'app-planet-page',
  imports: [
    CatalogueComponent,
    CelebrationComponent,
    InfoCardComponent,
    InventoryPanelComponent,
    LoadingComponent,
    PlacementHudComponent,
    PlanetViewComponent,
    ReceiptToastComponent,
    ReloadBannerComponent,
    RewardRevealComponent,
    SaveIndicatorComponent,
    SettingsPanelComponent,
    SkyListComponent,
    WelcomeBackComponent,
  ],
  providers: [
    SCENE_PROVIDERS,
    PlacementService,
    ReceiptService,
    CelebrationService,
    RewardRevealService,
  ],
  templateUrl: './planet-page.component.html',
  styleUrl: './planet-page.component.scss',
})
export class PlanetPageComponent {
  private readonly planets = inject(PlanetService);
  private readonly sync = inject(SyncService);

  protected readonly planet = inject(PlanetStore).snapshot;
  protected readonly sceneReady = inject(SceneService).ready;
  protected readonly loadFailed = signal(false);
  /** The settings or the catalogue, whichever is open; they share the space over the planet. */
  protected readonly panel = signal<'settings' | 'catalogue' | null>(null);
  private readonly loaded = computed(() => this.planet() !== null);

  constructor() {
    if (!this.planet()) {
      void this.load();
    }
    inject(CatalogueService).load();
    // Created now so they follow the snapshot and the input from the start.
    inject(PlantMeshService);
    inject(DecorationMeshService);
    inject(CreatureMeshService);
    inject(PlacementGhostService);
    inject(GardenInputService);
    inject(SkyService);
    inject(CloudDragController);
    inject(SunDragController);
    inject(CelebrationService);
    inject(RewardRevealService);
    // Syncs at once, then on the heartbeat. The cleanup also runs when the page closes, so the
    // heartbeat never outlives it.
    effect((onCleanup) => {
      if (this.loaded()) {
        untracked(() => {
          this.sync.syncNow();
          this.sync.startHeartbeat();
        });
        onCleanup(() => this.sync.stopHeartbeat());
      }
    });
  }

  /** Opens the panel, or closes it when it is already open. */
  protected toggle(panel: 'settings' | 'catalogue'): void {
    this.panel.update((open) => (open === panel ? null : panel));
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
