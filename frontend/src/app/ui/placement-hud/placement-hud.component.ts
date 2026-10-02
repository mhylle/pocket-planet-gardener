import { Component, computed, inject } from '@angular/core';
import { PlacementReason } from '../../core/helpers/placement-rules';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlacementService } from '../../core/services/placement.service';

type StatusIcon = 'free' | 'taken' | 'water' | 'full';

/** The preview's verdict in words, each with its own icon, never colour alone (SET-04). */
export const PLACEMENT_STATUS: Record<PlacementReason, { text: string; icon: StatusIcon }> = {
  ok: { text: 'Free spot', icon: 'free' },
  'occupied-plant': { text: 'Something is already there', icon: 'taken' },
  'occupied-decoration': { text: 'Something is already there', icon: 'taken' },
  'occupied-water': { text: "That's water", icon: 'water' },
  'planet-full': { text: 'Planet is full', icon: 'full' },
};

/**
 * What is being placed and whether the spot under the preview is free (GRD-01 AC2, AC3), with
 * a way to stop. Below it, the server's reason when it refused a change, in a live region.
 */
@Component({
  selector: 'app-placement-hud',
  templateUrl: './placement-hud.component.html',
  styleUrl: './placement-hud.component.scss',
})
export class PlacementHudComponent {
  private readonly catalogue = inject(CatalogueService);
  protected readonly placement = inject(PlacementService);

  protected readonly doing = computed(() => {
    const selected = this.placement.selected();
    if (!selected) {
      return null;
    }
    if (selected.mode === 'move') {
      return `Moving: ${this.catalogue.itemName({ ...selected, kind: 'decoration' })}`;
    }
    const name = this.catalogue.itemName(selected);
    return selected.kind === 'seed' ? `Planting: ${name}` : `Placing: ${name}`;
  });

  protected readonly status = computed(() => {
    const reason = this.placement.preview();
    return reason ? PLACEMENT_STATUS[reason] : null;
  });
}
