import { Component, inject, signal } from '@angular/core';
import { PlanetService } from '../../core/services/planet.service';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';

/**
 * The planet screen. Loads the stored planet when it is not known yet (startup, or after
 * opening by code). The 3D view replaces the placeholder in a later phase.
 */
@Component({
  selector: 'app-planet-page',
  imports: [SettingsPanelComponent],
  templateUrl: './planet-page.component.html',
  styleUrl: './planet-page.component.scss',
})
export class PlanetPageComponent {
  private readonly planets = inject(PlanetService);

  protected readonly planet = this.planets.planet;
  protected readonly loadFailed = signal(false);
  protected readonly settingsOpen = signal(false);

  constructor() {
    if (!this.planet()) {
      void this.load();
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
