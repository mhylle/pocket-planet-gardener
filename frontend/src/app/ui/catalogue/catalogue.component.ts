import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { humanDuration } from '../../core/helpers/human-duration';
import { StatusText, needsText } from '../../core/helpers/status-text';
import { CatalogueService } from '../../core/services/catalogue.service';
import { GameConfigService } from '../../core/services/game-config.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { StatusIconComponent } from '../status-icon/status-icon.component';

/** A plant type or decoration as the catalogue lists it. */
interface Entry {
  id: string;
  /** In the player's unlocks; otherwise only a silhouette and the hint show (ITM-03 AC1). */
  unlocked: boolean;
  name: string;
  description: string;
  hint: string;
  /** A plant's water and light preferences; none for a decoration. */
  needs: StatusText[];
  /** Roughly how long a plant takes to bloom; null for a decoration (GRD-05 AC2). */
  bloom: string | null;
}

interface Section {
  id: string;
  title: string;
  /** Picks the silhouette for the locked entries. */
  kind: 'plant' | 'decoration';
  entries: Entry[];
}

/**
 * Everything there is to find (ITM-03): every plant type and decoration, and every creature
 * species. Unlocked items show their name, description and, for plants, needs and time to
 * bloom (AC2); the rest show a plain silhouette and how to get them (AC1). Species show their
 * arrival hint (CRT-01 AC2), with a note when the planet has all the creatures it can hold
 * (CRT-02 AC1). It takes the focus when it opens; Escape or Close closes it, and the focus
 * goes back to where it was.
 */
@Component({
  selector: 'app-catalogue',
  imports: [StatusIconComponent],
  templateUrl: './catalogue.component.html',
  styleUrl: './catalogue.component.scss',
  host: { '(keydown.escape)': 'closed.emit()' },
})
export class CatalogueComponent {
  readonly closed = output<void>();

  private readonly catalogue = inject(CatalogueService).catalogue;
  private readonly snapshot = inject(PlanetStore).snapshot;
  private readonly config = inject(GameConfigService).config;
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  private readonly unlocks = computed(() => new Set(this.snapshot()?.unlocks ?? []));

  /** The plants, then the decorations. */
  protected readonly sections = computed<Section[]>(() => [
    {
      id: 'plants',
      title: 'Plants',
      kind: 'plant',
      entries: (this.catalogue()?.plants ?? []).map((plant) => ({
        id: plant.id,
        unlocked: this.unlocks().has(plant.id),
        name: plant.name,
        description: plant.description,
        hint: plant.unlockHint,
        needs: needsText(plant),
        bloom: humanDuration(plant.bloomMinutes),
      })),
    },
    {
      id: 'decorations',
      title: 'Decorations',
      kind: 'decoration',
      entries: (this.catalogue()?.decorations ?? []).map((decoration) => ({
        id: decoration.id,
        unlocked: this.unlocks().has(decoration.id),
        name: decoration.name,
        description: decoration.description,
        hint: decoration.unlockHint,
        needs: [],
        bloom: null,
      })),
    },
  ]);

  protected readonly species = computed(() => this.catalogue()?.species ?? []);

  /** The planet holds as many creatures as it can (CRT-02 AC1). */
  protected readonly cosy = computed(
    () => (this.snapshot()?.creatures?.length ?? 0) >= this.config().maxCreatures,
  );

  constructor() {
    const returnTo = document.activeElement as HTMLElement | null;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => this.dialog().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => {
      // Only when the focus was in here (or went with it), so a click elsewhere keeps its own.
      const focused = document.activeElement;
      if (!focused || focused === document.body || host.contains(focused)) {
        returnTo?.focus();
      }
    });
  }
}
