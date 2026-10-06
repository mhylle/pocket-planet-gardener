import { Component, ElementRef, computed, inject, signal, viewChildren } from '@angular/core';
import { waterStatus } from '../../core/helpers/growth-rules';
import { moodText, stageText, waterText } from '../../core/helpers/status-text';
import { SurfacePoint } from '../../core/helpers/surface-coords';
import { CatalogueService } from '../../core/services/catalogue.service';
import { CardTarget, PlacementService } from '../../core/services/placement.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { CreatureMeshService } from '../../scene/creature-mesh.service';
import { GardenInputService } from '../../scene/garden-input.service';
import { SceneService } from '../../scene/scene.service';
import { SelectionRingService } from '../../scene/selection-ring.service';

const NEXT_KEYS = ['ArrowDown', 'ArrowRight'];
const PREVIOUS_KEYS = ['ArrowUp', 'ArrowLeft'];

/** A creature, plant or decoration on the planet, as the list shows it. */
interface GardenOption {
  key: string;
  kind: CardTarget['kind'];
  id: string;
  /** What it is, such as "Mira the moth" or "Sunflower". */
  name: string;
  /** How it is in words, such as "in bloom, thirsty"; null for a decoration. */
  status: string | null;
  /** The name and the status together, as shown and said. */
  label: string;
  /** Where it stands; a creature's home spot. */
  point: SurfacePoint;
}

/**
 * Everything on the planet for the keyboard (SET-05): a listbox of the creatures, plants and
 * decorations, next after the canvas, with one Tab stop. Arrow keys, Home and End move between
 * them; the one moved to is said out loud, ringed in the scene (AC2) and turned to the middle
 * of the view. Enter or Space opens its card there, as a tap on it would (the creature card
 * leads on to chat); Escape goes back to the canvas. The list folds away while it does not have
 * the focus.
 */
@Component({
  selector: 'app-garden-list',
  templateUrl: './garden-list.component.html',
  styleUrl: './garden-list.component.scss',
})
export class GardenListComponent {
  private readonly store = inject(PlanetStore);
  private readonly catalogue = inject(CatalogueService);
  private readonly camera = inject(CameraControlsService);
  private readonly creatures = inject(CreatureMeshService);
  private readonly garden = inject(GardenInputService);
  private readonly placement = inject(PlacementService);
  private readonly scene = inject(SceneService);
  private readonly ring = inject(SelectionRingService);
  private readonly items = viewChildren<ElementRef<HTMLElement>>('item');

  /** The option last moved to; it stays the Tab stop while it is on the planet. */
  private readonly picked = signal<string | null>(null);
  /** The option with the focus, ringed in the scene; null while the list has none. */
  protected readonly shown = signal<string | null>(null);
  protected readonly announcement = signal('');

  /** The creatures, then the plants, then the decorations. */
  protected readonly options = computed<GardenOption[]>(() => {
    const snapshot = this.store.snapshot();
    if (!snapshot) {
      return [];
    }
    const name = (id: string) => this.catalogue.name(id);
    return [
      ...snapshot.creatures.map(({ id, name: called, species, mood, wistful, lat, lon }) =>
        option('creature', id, `${called} the ${name(species).toLowerCase()}`, {
          status: moodText(mood, wistful).text,
          point: { lat, lon },
        }),
      ),
      ...snapshot.plants.map(({ id, type, stage, harvestReady, water, lat, lon }) =>
        option('plant', id, name(type), {
          status: `${stageText(stage, harvestReady).text}, ${waterText(waterStatus(water)).text}`,
          point: { lat, lon },
        }),
      ),
      ...snapshot.decorations.map(({ id, type, lat, lon }) =>
        option('decoration', id, name(type), { status: null, point: { lat, lon } }),
      ),
    ];
  });

  /** The list's one Tab stop: the option last moved to, or the first. */
  protected readonly tabStop = computed(() => {
    const options = this.options();
    return options.find(({ key }) => key === this.picked())?.key ?? options[0]?.key ?? null;
  });

  /** The option got the focus: ring it, turn the planet to it and say what it is. */
  protected show(option: GardenOption): void {
    this.picked.set(option.key);
    this.shown.set(option.key);
    this.ring.select({ kind: option.kind, id: option.id });
    // A creature is turned to where it has wandered.
    const drawn = option.kind === 'creature' ? this.creatures.creature(option.id) : undefined;
    this.camera.focusOn(drawn?.point ?? option.point);
    this.announce(option.label);
  }

  protected hide(option: GardenOption): void {
    if (this.shown() === option.key) {
      this.shown.set(null);
      this.ring.select(null);
    }
  }

  protected key(event: KeyboardEvent, option: GardenOption): void {
    const options = this.options();
    const at = options.indexOf(option);
    let to: number | null = null;
    if (NEXT_KEYS.includes(event.key)) {
      to = Math.min(at + 1, options.length - 1);
    } else if (PREVIOUS_KEYS.includes(event.key)) {
      to = Math.max(at - 1, 0);
    } else if (event.key === 'Home') {
      to = 0;
    } else if (event.key === 'End') {
      to = options.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // At the middle of the view, where the planet turns it, as Enter on the canvas does.
      this.placement.openCard({ kind: option.kind, id: option.id, ...this.garden.centre() });
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.scene.focusCanvas();
      return;
    }
    if (to !== null) {
      // The page would scroll as well.
      event.preventDefault();
      this.items()[to]?.nativeElement.focus();
    }
  }

  private announce(text: string): void {
    // The same words twice in a row would not be read out again, so a repeat differs unseen.
    this.announcement.update((previous) => (previous === text ? `${text} ` : text));
  }
}

function option(
  kind: GardenOption['kind'],
  id: string,
  name: string,
  { status, point }: { status: string | null; point: SurfacePoint },
): GardenOption {
  const words = status?.toLowerCase() ?? null;
  return {
    key: `${kind}:${id}`,
    kind,
    id,
    name,
    status: words,
    label: words ? `${name}, ${words}` : name,
    point,
  };
}
