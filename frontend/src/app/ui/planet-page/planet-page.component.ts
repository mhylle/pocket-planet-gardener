import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { InventoryItemDto } from '../../core/models/planet-snapshot';
import { AudioService } from '../../core/services/audio.service';
import { CatalogueService } from '../../core/services/catalogue.service';
import { CelebrationService } from '../../core/services/celebration.service';
import { ChatService } from '../../core/services/chat.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetService } from '../../core/services/planet.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { RewardRevealService } from '../../core/services/reward-reveal.service';
import { SettingsService } from '../../core/services/settings.service';
import { SyncService } from '../../core/services/sync.service';
import { TutorialService } from '../../core/services/tutorial.service';
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
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';
import { GardenListComponent } from '../garden-list/garden-list.component';
import { InfoCardComponent } from '../info-card/info-card.component';
import { InventoryPanelComponent } from '../inventory-panel/inventory-panel.component';
import { JournalBookComponent } from '../journal-book/journal-book.component';
import { JournalPageComponent } from '../journal-page/journal-page.component';
import { LoadingComponent } from '../loading/loading.component';
import { PipComponent } from '../pip/pip.component';
import { PlacementHudComponent } from '../placement-hud/placement-hud.component';
import { ReceiptToastComponent } from '../receipt-toast/receipt-toast.component';
import { ReloadBannerComponent } from '../reload-banner/reload-banner.component';
import { RewardRevealComponent } from '../reward-reveal/reward-reveal.component';
import { SaveIndicatorComponent } from '../save-indicator/save-indicator.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';
import { ShortcutHelpComponent } from '../shortcut-help/shortcut-help.component';
import { SkyListComponent } from '../sky-list/sky-list.component';
import { WelcomeBackComponent } from '../welcome-back/welcome-back.component';

/** A panel that opens over the planet from its button in the bar. */
type Panel = 'settings' | 'catalogue' | 'journal' | 'shortcuts';

/**
 * The planet screen: the 3D planet with its sky, the planet's name, save state, inventory,
 * catalogue, journal, settings and a creature's chat around it, and the journal page and what
 * changed for a returning player. Loads the stored planet when it is not known yet (startup,
 * or after opening by code) and keeps it in sync while it is shown. Pip shows until the planet
 * is loaded and first drawn (NFR-03), then guides a new player, pointing at the part of the
 * screen each step is about (ONB-01). The page owns the 3D scene, the gardening state and the
 * tutorial, so every panel on it can reach them. The planet's sound and motion settings apply
 * while it is shown. Everything on it can be played by keyboard (SET-05): Tab goes from the
 * planet to the garden list, the sky, the inventory and the menus, and "?" shows the keys.
 */
@Component({
  selector: 'app-planet-page',
  imports: [
    CatalogueComponent,
    CelebrationComponent,
    ChatPanelComponent,
    GardenListComponent,
    InfoCardComponent,
    InventoryPanelComponent,
    JournalBookComponent,
    JournalPageComponent,
    LoadingComponent,
    PipComponent,
    PlacementHudComponent,
    PlanetViewComponent,
    ReceiptToastComponent,
    ReloadBannerComponent,
    RewardRevealComponent,
    SaveIndicatorComponent,
    SettingsPanelComponent,
    ShortcutHelpComponent,
    SkyListComponent,
    WelcomeBackComponent,
  ],
  providers: [
    SCENE_PROVIDERS,
    PlacementService,
    ReceiptService,
    CelebrationService,
    RewardRevealService,
    TutorialService,
  ],
  templateUrl: './planet-page.component.html',
  styleUrl: './planet-page.component.scss',
})
export class PlanetPageComponent {
  private readonly planets = inject(PlanetService);
  private readonly sync = inject(SyncService);
  private readonly settings = inject(SettingsService);
  private readonly chat = inject(ChatService);
  // Created with the page, so it watches the player from the start.
  protected readonly tutorial = inject(TutorialService);

  private readonly scene = inject(SceneService);

  protected readonly planet = inject(PlanetStore).snapshot;
  protected readonly sceneReady = this.scene.ready;
  protected readonly loadFailed = signal(false);
  /** Read out, not shown: what to do next after choosing an item. */
  protected readonly announcement = signal('');
  /**
   * The settings, the catalogue, the journal or the shortcut help, whichever is open; they
   * share the space over the planet.
   */
  protected readonly panel = signal<Panel | null>(null);
  /**
   * The creature whose chat is open, as a list of one so another creature's chat starts
   * afresh; empty when none is, or when it is not on this planet.
   */
  protected readonly chatWith = computed(() => {
    const id = this.chat.creatureId();
    const creature = this.planet()?.creatures.find((each) => each.id === id);
    return creature ? [creature] : [];
  });
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
    // Waits for the player's first gesture to start the sound.
    inject(AudioService);
    // Syncs at once, then on the heartbeat, and loads the settings. The cleanup also runs when
    // the page closes, so neither the heartbeat nor the settings outlive it.
    effect((onCleanup) => {
      if (this.loaded()) {
        untracked(() => {
          this.sync.syncNow();
          this.sync.startHeartbeat();
          this.settings.load();
        });
        onCleanup(() => {
          this.sync.stopHeartbeat();
          this.settings.reset();
        });
      }
    });
    // Listened to directly, so the many other keys pressed on the page cost nothing.
    const shortcut = (event: KeyboardEvent) => this.shortcut(event);
    document.addEventListener('keydown', shortcut);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', shortcut));
  }

  /** Opens the panel, or closes it when it is already open. */
  protected toggle(panel: Panel): void {
    this.panel.update((open) => (open === panel ? null : panel));
  }

  /**
   * A seed or decoration was chosen in the inventory: the keys go to the planet, so the player
   * can turn it and press Enter at once instead of tabbing back past the sky (SET-05).
   */
  protected chose(kind: InventoryItemDto['kind']): void {
    this.scene.focusCanvas();
    const what = kind === 'seed' ? 'plant' : 'place it';
    const text = `Turn the planet with the arrows, then press Enter to ${what} at the ring`;
    // The same words twice in a row would not be read out again, so a repeat differs unseen.
    this.announcement.update((previous) => (previous === text ? `${text} ` : text));
  }

  /** "?" opens the shortcut help, except while the player is typing. */
  private shortcut(event: KeyboardEvent): void {
    const target = event.target;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    if (event.key === '?' && !typing && this.planet()) {
      event.preventDefault();
      this.panel.set('shortcuts');
    }
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
