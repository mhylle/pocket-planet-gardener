import { Component, inject } from '@angular/core';
import { PageReloadService } from '../../core/services/page-reload.service';
import { PlanetStore } from '../../core/services/planet-store.service';

/** Asks for a reload when another device changed the planet, instead of overwriting (ACC-04 AC2). */
@Component({
  selector: 'app-reload-banner',
  templateUrl: './reload-banner.component.html',
  styleUrl: './reload-banner.component.scss',
})
export class ReloadBannerComponent {
  private readonly page = inject(PageReloadService);

  protected readonly reloadRequired = inject(PlanetStore).reloadRequired;

  protected reload(): void {
    this.page.reload();
  }
}
