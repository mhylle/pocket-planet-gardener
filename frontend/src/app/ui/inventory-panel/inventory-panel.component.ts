import { Component, computed, inject, output } from '@angular/core';
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
 * (AC2). Choosing an item starts placing it, and says so to the page, which hands the keys on
 * to the planet (SET-05); choosing it again, or Escape, stops.
 */
@Component({
  selector: 'app-inventory-panel',
  templateUrl: './inventory-panel.component.html',
  styleUrl: './inventory-panel.component.scss',
  host: { '(document:keydown.escape)': 'placement.cancel()', '(click)': 'clicked($event)' },
})
export class InventoryPanelComponent {
  /** An item was chosen to plant (a seed) or to place (a decoration). */
  readonly chosen = output<InventoryItemDto['kind']>();

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

  /**
   * A click on an item button has just run, so it has chosen that item or put it back; only
   * choosing it counts. Enter and Space on a button arrive as clicks too.
   */
  protected clicked(event: MouseEvent): void {
    const selected = this.placement.selected();
    if (selected?.mode === 'place' && (event.target as Element).closest('button')) {
      this.chosen.emit(selected.kind);
    }
  }
}
