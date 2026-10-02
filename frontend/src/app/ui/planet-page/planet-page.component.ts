import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetService } from '../../core/services/planet.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { SyncService } from '../../core/services/sync.service';
import { DecorationMeshService } from '../../scene/decoration-mesh.service';
import { GardenInputService } from '../../scene/garden-input.service';
import { PlacementGhostService } from '../../scene/placement-ghost.service';
import { PlantMeshService } from '../../scene/plant-mesh.service';
import { PlanetViewComponent } from '../../scene/planet-view/planet-view.component';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { InventoryPanelComponent } from '../inventory-panel/inventory-panel.component';
import { LoadingComponent } from '../loading/loading.component';
import { PlacementHudComponent } from '../placement-hud/placement-hud.component';
import { ReceiptToastComponent } from '../receipt-toast/receipt-toast.component';
import { ReloadBannerComponent } from '../reload-banner/reload-banner.component';
import { SaveIndicatorComponent } from '../save-indicator/save-indicator.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';

/**
 * The planet screen: the 3D planet with the planet's name, save state, inventory and settings
 * around it. Loads the stored planet when it is not known yet (startup, or after opening by
 * code) and keeps it in sync while it is shown. Pip shows until the planet is loaded and first
 * drawn (NFR-03). The page owns the 3D scene and the gardening state, so every panel on it can
 * reach them.
 */
@Component({
  selector: 'app-planet-page',
  imports: [
    ContextMenuComponent,
    InventoryPanelComponent,
    LoadingComponent,
    PlacementHudComponent,
    PlanetViewComponent,
    ReceiptToastComponent,
    ReloadBannerComponent,
    SaveIndicatorComponent,
    SettingsPanelComponent,
  ],
  providers: [SCENE_PROVIDERS, PlacementService, ReceiptService],
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
    inject(CatalogueService).load();
    // Created now so they follow the snapshot and the input from the start.
    inject(PlantMeshService);
    inject(DecorationMeshService);
    inject(PlacementGhostService);
    inject(GardenInputService);
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
