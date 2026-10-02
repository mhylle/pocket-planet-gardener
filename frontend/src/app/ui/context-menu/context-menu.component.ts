import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SceneService } from '../../scene/scene.service';

/** Room the menu needs from the canvas edges, in CSS pixels, so it is never cut off. */
const MENU_HALF_WIDTH = 90;
const MENU_HEIGHT = 130;

/**
 * The actions for a tapped plant or decoration, next to it: "Dig up" for a plant (GRD-07
 * AC1), "Move" and "Put away" for a decoration (ITM-02 AC2, AC3). Opening it moves the focus
 * to its first button; Escape or a press anywhere else closes it, and the focus goes back.
 */
@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.scss',
  host: {
    '(document:pointerdown)': 'pressed($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class ContextMenuComponent {
  private readonly store = inject(PlanetStore);
  private readonly catalogue = inject(CatalogueService);
  private readonly scene = inject(SceneService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly placement = inject(PlacementService);
  protected readonly menu = this.placement.menu;
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  /** Where the focus was before the menu took it. */
  private returnTo: HTMLElement | null = null;

  protected readonly title = computed(() => {
    const menu = this.menu();
    const snapshot = this.store.snapshot();
    if (!menu || !snapshot) {
      return '';
    }
    if (menu.kind === 'plant') {
      const plant = snapshot.plants.find(({ id }) => id === menu.id);
      return plant
        ? `${this.catalogue.plant(plant.type)?.name ?? plant.type} (${plant.stage})`
        : '';
    }
    const decoration = snapshot.decorations.find(({ id }) => id === menu.id);
    return decoration
      ? this.catalogue.itemName({ itemType: decoration.type, kind: 'decoration' })
      : '';
  });

  /** The menu's spot on the canvas, kept clear of its edges. */
  protected readonly position = computed(() => {
    const menu = this.menu();
    if (!menu) {
      return { x: 0, y: 0 };
    }
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max));
    return {
      x: clamp(menu.x, MENU_HALF_WIDTH, this.scene.width - MENU_HALF_WIDTH),
      y: clamp(menu.y, 0, this.scene.height - MENU_HEIGHT),
    };
  });

  constructor() {
    effect(() => {
      const box = this.box()?.nativeElement;
      if (box) {
        this.returnTo = document.activeElement as HTMLElement | null;
        box.querySelector('button')?.focus();
      }
    });
  }

  protected digUp(id: string): void {
    this.restoreFocus();
    void this.placement.digUp(id);
  }

  protected move(id: string): void {
    this.restoreFocus();
    this.placement.startMove(id);
  }

  protected putAway(id: string): void {
    this.restoreFocus();
    void this.placement.putAway(id);
  }

  protected close(): void {
    if (this.menu()) {
      this.restoreFocus();
      this.placement.closeMenu();
    }
  }

  protected pressed(event: PointerEvent): void {
    if (this.menu() && !this.host.nativeElement.contains(event.target as Node)) {
      this.placement.closeMenu();
    }
  }

  private restoreFocus(): void {
    this.returnTo?.focus();
    this.returnTo = null;
  }
}
