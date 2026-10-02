import { Injectable, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SurfacePoint } from '../core/helpers/surface-coords';
import { PlacementService } from '../core/services/placement.service';
import { InputService, KeyInput } from './input.service';
import { PickKind, PickResult, PickingService } from './picking.service';
import { SceneService } from './scene.service';

/** Hits on these stand for the surface point under them. */
const SURFACE_KINDS: readonly PickKind[] = ['planet', 'plant', 'decoration'];
const ENTER_CODES = ['Enter', 'NumpadEnter'];

/**
 * Turns gestures on the canvas into gardening. With an item selected, the preview follows
 * the mouse (or sits at the middle of the view when there is no mouse over the canvas) and a
 * tap, or Enter, puts the item down there. Without one, tapping a plant or decoration (or
 * pressing Enter while one is in the middle of the view) opens its menu. Escape stops placing.
 */
@Injectable()
export class GardenInputService {
  private readonly scene = inject(SceneService);
  private readonly picking = inject(PickingService);
  private readonly placement = inject(PlacementService);
  /** Where the mouse is over the canvas; null when it is elsewhere. */
  private pointer: { x: number; y: number } | null = null;
  private enterHeld = false;

  constructor() {
    const input = inject(InputService);
    input.hover.pipe(takeUntilDestroyed()).subscribe((hover) => {
      this.pointer = hover;
      this.followPointer();
    });
    input.tap.pipe(takeUntilDestroyed()).subscribe((tap) => this.choose(tap));
    input.drag.pipe(takeUntilDestroyed()).subscribe(() => this.placement.closeMenu());
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
    const point = this.placement.selected()
      ? surfaceOf(this.picking.pick(this.pointer ?? this.centre()))
      : null;
    this.placement.setHover(point);
  }

  /** A tap or Enter at a canvas point: place the selected item there, or open a menu. */
  private choose(at: { x: number; y: number }): void {
    const hit = this.picking.pick(at);
    if (this.placement.selected()) {
      const point = surfaceOf(hit);
      if (point) {
        void this.placement.placeAt(point);
      }
      return;
    }
    if (hit?.id && (hit.kind === 'plant' || hit.kind === 'decoration')) {
      this.placement.openMenu({ kind: hit.kind, id: hit.id, ...at });
    } else {
      this.placement.closeMenu();
    }
  }

  private key({ code, key, down }: KeyInput): void {
    if (ENTER_CODES.includes(code)) {
      // A held Enter repeats; only the first press counts.
      const pressed = down && !this.enterHeld;
      this.enterHeld = down;
      if (pressed) {
        this.choose(this.centre());
      }
    } else if (down && key === 'Escape') {
      this.placement.cancel();
      this.placement.closeMenu();
    }
  }
}

function surfaceOf(hit: PickResult | null): SurfacePoint | null {
  return hit && SURFACE_KINDS.includes(hit.kind) ? (hit.surface ?? null) : null;
}
