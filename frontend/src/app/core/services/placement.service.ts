import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { errorMessage, hasStatus } from '../helpers/error-message';
import {
  PLANT_FOOTPRINT_STEPS,
  PlacementCandidate,
  PlacementReason,
  PlacementState,
  canPlaceAt,
} from '../helpers/placement-rules';
import { SurfacePoint } from '../helpers/surface-coords';
import { InventoryItemDto } from '../models/planet-snapshot';
import { CatalogueService } from './catalogue.service';
import { PlanetStore } from './planet-store.service';
import { Command, SyncService } from './sync.service';

/** What the next tap on the planet puts down: an inventory item, or a decoration to move. */
export type PlacementSelection =
  | { mode: 'place'; itemType: string; kind: InventoryItemDto['kind'] }
  | { mode: 'move'; itemType: string; decorationId: string };

/** A plant, decoration or creature whose card is open, and where on the canvas, in CSS pixels. */
export interface CardTarget {
  kind: 'plant' | 'decoration' | 'creature';
  id: string;
  x: number;
  y: number;
}

/**
 * Planting, placing, moving, removing and harvesting things on the planet (GRD-01, GRD-07,
 * GRD-08, ITM-02). Holds the selected item and the point under the pointer, and previews
 * whether the item may go there with the same rules the server applies. Also holds which
 * info card is open: the pinned one a tap opens, with its actions, and the read-only one for
 * what the mouse is over (NAV-03). Every change goes to the server as a command; when it
 * refuses one, its message shows and the selection stays, so the player can try another spot.
 * Provided by the planet page, so a selection never outlives it.
 */
@Injectable()
export class PlacementService {
  private readonly sync = inject(SyncService);
  private readonly store = inject(PlanetStore);
  private readonly catalogue = inject(CatalogueService);

  private readonly selection = signal<PlacementSelection | null>(null);
  private readonly hoverPoint = signal<SurfacePoint | null>(null, { equal: samePoint });
  private readonly pendingPoint = signal<SurfacePoint | null>(null);
  private readonly refusal = signal<string | null>(null);
  private readonly cardTarget = signal<CardTarget | null>(null);
  private readonly hoverTarget = signal<CardTarget | null>(null, { equal: sameTarget });
  /** The thing whose hover card Escape closed; it stays closed until the pointer moves on. */
  private dismissedId: string | null = null;

  readonly selected = this.selection.asReadonly();
  /** The surface point under the pointer (or the view centre); null over open sky. */
  readonly hover = this.hoverPoint.asReadonly();
  /** The server's line for the last refused change; cleared when a change goes through. */
  readonly message = this.refusal.asReadonly();
  /** The pinned info card, with actions. */
  readonly card = this.cardTarget.asReadonly();
  /** The read-only info card for what the mouse is over. */
  readonly hoverCard = this.hoverTarget.asReadonly();

  /** Where the preview shows: the spot being saved, otherwise the hover point. */
  readonly previewPoint = computed(() => this.pendingPoint() ?? this.hoverPoint());
  /** True while a placement waits for the server. */
  readonly saving = computed(() => this.pendingPoint() !== null);

  /** Steps across of the selected item, for the preview. */
  readonly footprintSteps = computed(() => {
    const selected = this.selection();
    return selected ? this.candidate(selected, { lat: 0, lon: 0 }).footprintSteps : 0;
  });

  /** Whether the selected item may go at the preview point; null without either (GRD-01 AC2). */
  readonly preview = computed<PlacementReason | null>(() => {
    const selected = this.selection();
    const point = this.previewPoint();
    const state = this.state();
    return selected && point && state ? canPlaceAt(state, this.candidate(selected, point)) : null;
  });

  /** What is on the planet, in the shape the placement rules read. */
  private readonly state = computed<PlacementState | null>(() => {
    const snapshot = this.store.snapshot();
    if (!snapshot) {
      return null;
    }
    return {
      plants: snapshot.plants.map(({ id, lat, lon }) => ({ id, lat, lon })),
      decorations: snapshot.decorations.map(({ id, type, lat, lon }) => {
        const decoration = this.catalogue.decoration(type);
        return {
          id,
          lat,
          lon,
          footprintSteps: decoration?.footprintSteps ?? 1,
          isWater: decoration?.isWater ?? false,
        };
      }),
      maxPlants: snapshot.maxPlants,
    };
  });

  /** Picks an inventory item to place; picking the selected one again puts it back. */
  select(item: Pick<InventoryItemDto, 'itemType' | 'kind'>): void {
    const selected = this.selection();
    const same =
      selected?.mode === 'place' &&
      selected.itemType === item.itemType &&
      selected.kind === item.kind;
    this.closeCard();
    this.refusal.set(null);
    this.selection.set(same ? null : { mode: 'place', itemType: item.itemType, kind: item.kind });
  }

  /** Picks up a placed decoration; the next placement moves it there (ITM-02 AC2). */
  startMove(decorationId: string): void {
    const decoration = this.store.snapshot()?.decorations.find(({ id }) => id === decorationId);
    this.closeCard();
    this.refusal.set(null);
    this.selection.set(
      decoration ? { mode: 'move', itemType: decoration.type, decorationId } : null,
    );
  }

  /** Leaves placement mode. */
  cancel(): void {
    this.selection.set(null);
  }

  setHover(point: SurfacePoint | null): void {
    this.hoverPoint.set(point);
  }

  /**
   * Plants, places or moves the selected item at the point. Ignored without a selection or
   * while the previous placement is still being saved. Seeds and decorations stay selected
   * while the player owns more; a move is done after one placement.
   */
  async placeAt({ lat, lon }: SurfacePoint): Promise<void> {
    const selected = this.selection();
    if (!selected || this.pendingPoint()) {
      return;
    }
    this.pendingPoint.set({ lat, lon });
    const command: Command =
      selected.mode === 'move'
        ? {
            method: 'PATCH',
            path: `/garden/decorations/${encodeURIComponent(selected.decorationId)}/position`,
            body: { lat, lon },
          }
        : {
            method: 'POST',
            path: selected.kind === 'seed' ? '/garden/plants' : '/garden/decorations',
            body: { itemType: selected.itemType, lat, lon },
          };
    const outcome = await this.run(command);
    this.pendingPoint.set(null);
    if (this.selection() !== selected) {
      return;
    }
    const finished =
      outcome === 'done' ? selected.mode === 'move' || !this.owns(selected) : outcome === 'gone';
    if (finished) {
      this.selection.set(null);
    }
  }

  /** Digs up a plant; a seed or sprout comes back to the inventory (GRD-07 AC1). */
  async digUp(plantId: string): Promise<void> {
    this.closeCard();
    await this.run({
      method: 'DELETE',
      path: `/garden/plants/${encodeURIComponent(plantId)}`,
      body: {},
    });
  }

  /**
   * Collects the seeds of a bloom that shows the sparkle; the plant stays in bloom (GRD-08
   * AC2). The seeds arrive as a receipt; too soon after the last harvest, the server says so.
   */
  async harvest(plantId: string): Promise<void> {
    this.closeCard();
    await this.run({
      method: 'POST',
      path: `/garden/plants/${encodeURIComponent(plantId)}/harvest`,
      body: {},
    });
  }

  /** Puts a decoration back in the inventory (ITM-02 AC3). */
  async putAway(decorationId: string): Promise<void> {
    this.closeCard();
    await this.run({
      method: 'DELETE',
      path: `/garden/decorations/${encodeURIComponent(decorationId)}`,
      body: {},
    });
  }

  openCard(target: CardTarget): void {
    this.cardTarget.set(target);
  }

  closeCard(): void {
    this.cardTarget.set(null);
  }

  /** Shows the read-only card for what the mouse is over; null hides it (NAV-03 AC3). */
  setHoverCard(target: CardTarget | null): void {
    if (target && target.id === this.dismissedId) {
      return;
    }
    this.dismissedId = null;
    this.hoverTarget.set(target);
  }

  /** Hides the hover card until the pointer moves on to something else. */
  dismissHoverCard(): void {
    this.dismissedId = this.hoverTarget()?.id ?? null;
    this.hoverTarget.set(null);
  }

  /**
   * Sends the command. Refused shows the server's reason; gone means the thing it names no
   * longer exists (404).
   */
  private async run(command: Command): Promise<'done' | 'refused' | 'gone'> {
    try {
      await this.sync.send(command);
      this.refusal.set(null);
      return 'done';
    } catch (error) {
      // A conflict has its own banner, and a closed planet needs no word.
      if (error instanceof HttpErrorResponse && !hasStatus(error, 409)) {
        this.refusal.set(errorMessage(error));
      }
      return hasStatus(error, 404) ? 'gone' : 'refused';
    }
  }

  private candidate(selected: PlacementSelection, point: SurfacePoint): PlacementCandidate {
    if (selected.mode === 'place' && selected.kind === 'seed') {
      return { kind: 'plant', point, footprintSteps: PLANT_FOOTPRINT_STEPS };
    }
    const footprintSteps = this.catalogue.decoration(selected.itemType)?.footprintSteps ?? 1;
    return selected.mode === 'move'
      ? { kind: 'decoration', point, footprintSteps, ignoreId: selected.decorationId }
      : { kind: 'decoration', point, footprintSteps };
  }

  private owns({ itemType, kind }: PlacementSelection & { mode: 'place' }): boolean {
    return (this.store.snapshot()?.inventory ?? []).some(
      (item) => item.itemType === itemType && item.kind === kind && item.count > 0,
    );
  }
}

function samePoint(a: SurfacePoint | null, b: SurfacePoint | null): boolean {
  return a === b || (a !== null && b !== null && a.lat === b.lat && a.lon === b.lon);
}

function sameTarget(a: CardTarget | null, b: CardTarget | null): boolean {
  return (
    a === b ||
    (a !== null && b !== null && a.id === b.id && a.kind === b.kind && a.x === b.x && a.y === b.y)
  );
}
