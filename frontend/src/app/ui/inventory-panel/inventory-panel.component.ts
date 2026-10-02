import { Component, computed, inject } from '@angular/core';
import { InventoryItemDto } from '../../core/models/planet-snapshot';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetStore } from '../../core/services/planet-store.service';

interface InventoryEntry extends InventoryItemDto {
  name: string;
  selected: boolean;
}

/**
 * What the player owns, with counts (ITM-01 AC1); a type they own none of is not listed
 * (AC2). Choosing an item starts placing it; choosing it again, or Escape, stops.
 */
@Component({
  selector: 'app-inventory-panel',
  templateUrl: './inventory-panel.component.html',
  styleUrl: './inventory-panel.component.scss',
  host: { '(document:keydown.escape)': 'placement.cancel()' },
})
export class InventoryPanelComponent {
  private readonly store = inject(PlanetStore);
  private readonly catalogue = inject(CatalogueService);
  protected readonly placement = inject(PlacementService);

  protected readonly items = computed<InventoryEntry[]>(() => {
    const selected = this.placement.selected();
    return (this.store.snapshot()?.inventory ?? [])
      .filter((item) => item.count > 0)
      .map((item) => ({
        ...item,
        name: this.catalogue.itemName(item, item.count),
        selected:
          selected?.mode === 'place' &&
          selected.itemType === item.itemType &&
          selected.kind === item.kind,
      }));
  });
}
