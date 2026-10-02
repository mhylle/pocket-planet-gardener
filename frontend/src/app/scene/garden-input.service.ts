import { Injectable, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { presentPlant } from '../core/helpers/plant-presenter';
import { SurfacePoint } from '../core/helpers/surface-coords';
import { CardTarget, PlacementService } from '../core/services/placement.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { InputService, KeyInput } from './input.service';
import { PickKind, PickResult, PickingService } from './picking.service';
import { SceneService } from './scene.service';

/** Hits on these stand for the surface point under them. */
const SURFACE_KINDS: readonly PickKind[] = ['planet', 'plant', 'decoration'];
const ENTER_CODES = ['Enter', 'NumpadEnter'];

/**
 * Turns gestures on the canvas into gardening. With an item selected, the preview follows
 * the mouse (or sits at the middle of the view when there is no mouse over the canvas) and a
 * tap, or Enter, puts the item down there. Without one, the mouse over a plant or decoration
 * shows its card; tapping it (or pressing Enter while it is in the middle of the view) pins
 * the card, except that tapping a bloom with seeds ready collects them (GRD-08 AC2). Escape
 * stops placing.
 */
@Injectable()
export class GardenInputService {
  private readonly scene = inject(SceneService);
  private readonly picking = inject(PickingService);
  private readonly placement = inject(PlacementService);
  private readonly store = inject(PlanetStore);
  /** Where the mouse is over the canvas; null when it is elsewhere. */
  private pointer: { x: number; y: number } | null = null;
  private enterHeld = false;
  /** The planet is being turned, so nothing under the pointer shows its card. */
  private dragging = false;

  constructor() {
    const input = inject(InputService);
    input.hover.pipe(takeUntilDestroyed()).subscribe((hover) => {
      this.pointer = hover;
      this.followPointer();
    });
    input.tap.pipe(takeUntilDestroyed()).subscribe((tap) => this.choose(tap, true));
    input.drag.pipe(takeUntilDestroyed()).subscribe(() => {
      this.dragging = true;
      this.placement.closeCard();
      this.placement.setHoverCard(null);
    });
    input.dragEnd.pipe(takeUntilDestroyed()).subscribe(() => {
      this.dragging = false;
      this.followPointer();
    });
    input.key.pipe(takeUntilDestroyed()).subscribe((key) => this.key(key));
    // The planet may turn under a still pointer.
    this.scene.onFrame(() => this.followPointer());
    effect(() => {
      this.placement.selected();
      untracked(() => this.followPointer());
    });
  }

  /** The middle of the view, in CSS pixels; Enter acts here. */
  centre(): { x: number; y: number } {
    return { x: this.scene.width / 2, y: this.scene.height / 2 };
  }

  private followPointer(): void {
    if (this.placement.selected()) {
      this.placement.setHover(surfaceOf(this.picking.pick(this.pointer ?? this.centre())));
      this.placement.setHoverCard(null);
      return;
    }
    this.placement.setHover(null);
    const pointer = this.dragging || this.placement.card() ? null : this.pointer;
    this.placement.setHoverCard(pointer ? cardOf(this.picking.pick(pointer), pointer) : null);
  }

  /**
   * A tap or Enter at a canvas point: place the selected item there, or pin the card of what
   * is there. A tap on a bloom with seeds ready collects them instead.
   */
  private choose(at: { x: number; y: number }, tapped: boolean): void {
    const hit = this.picking.pick(at);
    if (this.placement.selected()) {
      const point = surfaceOf(hit);
      if (point) {
        void this.placement.placeAt(point);
      }
      return;
    }
    const card = cardOf(hit, at);
    if (card && tapped && card.kind === 'plant' && this.seedsReady(card.id)) {
      this.placement.closeCard();
      void this.placement.harvest(card.id);
    } else if (card) {
      this.placement.openCard(card);
    } else {
      this.placement.closeCard();
    }
  }

  /** The plant shows the sparkle (GRD-08 AC1). */
  private seedsReady(plantId: string): boolean {
    const plant = this.store.snapshot()?.plants.find(({ id }) => id === plantId);
    return plant !== undefined && presentPlant(plant).sparkle;
  }

  private key({ code, key, down }: KeyInput): void {
    if (ENTER_CODES.includes(code)) {
      // A held Enter repeats; only the first press counts.
      const pressed = down && !this.enterHeld;
      this.enterHeld = down;
      if (pressed) {
        this.choose(this.centre(), false);
      }
    } else if (down && key === 'Escape') {
      this.placement.cancel();
      this.placement.closeCard();
    }
  }
}

function surfaceOf(hit: PickResult | null): SurfacePoint | null {
  return hit && SURFACE_KINDS.includes(hit.kind) ? (hit.surface ?? null) : null;
}

/** The card for a hit plant or decoration, at a canvas point; null for anything else. */
function cardOf(hit: PickResult | null, at: { x: number; y: number }): CardTarget | null {
  return hit?.id && (hit.kind === 'plant' || hit.kind === 'decoration')
    ? { kind: hit.kind, id: hit.id, x: at.x, y: at.y }
    : null;
}
