import { Component, computed, inject } from '@angular/core';
import { PlanetStore } from '../../core/services/planet-store.service';

/**
 * A small, calm note while changes are being saved or wait for the connection (ACC-03 AC3).
 * Icon and text together, so it never relies on colour alone (SET-04).
 */
@Component({
  selector: 'app-save-indicator',
  templateUrl: './save-indicator.component.html',
  styleUrl: './save-indicator.component.scss',
})
export class SaveIndicatorComponent {
  private readonly store = inject(PlanetStore);

  protected readonly offline = this.store.offline;
  protected readonly saving = computed(() => this.store.pendingCommands() > 0);
}
