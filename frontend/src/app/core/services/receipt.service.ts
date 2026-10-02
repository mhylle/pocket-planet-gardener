import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { InventoryItemDto, PlanetSnapshotDto } from '../models/planet-snapshot';
import { CatalogueService } from './catalogue.service';
import { PlanetStore } from './planet-store.service';

/** A short note that something went into the inventory, such as "+1 Clover seed". */
export interface Receipt {
  id: number;
  text: string;
}

/** How long a receipt shows, in ms; the toast's animation runs for the same time. */
export const RECEIPT_MS = 1800;

/**
 * Notices items arriving in the inventory (ITM-01 AC3). Every time the planet's snapshot
 * changes, the inventory counts are compared with the previous snapshot of the same planet,
 * and each count that went up gives one receipt. So a seed back from digging up, a decoration
 * put away and later harvests or gifts are all announced once, whichever response brought
 * them. Provided by the planet page; the first snapshot it sees counts as the starting point.
 * While held, such as while a reward is being shown (WNT-04 AC1), receipts wait and show once
 * released.
 */
@Injectable()
export class ReceiptService {
  private readonly catalogue = inject(CatalogueService);
  private readonly list = signal<Receipt[]>([]);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private seen: { planetId: string; counts: Map<string, number> } | null = null;
  private nextId = 1;
  private waiting: string[] | null = null;

  readonly receipts = this.list.asReadonly();

  /** Keeps new receipts back until release(). */
  hold(): void {
    this.waiting ??= [];
  }

  /** Shows the receipts kept back, and every later one as it comes. */
  release(): void {
    const waiting = this.waiting ?? [];
    this.waiting = null;
    waiting.forEach((text) => this.show(text));
  }

  constructor() {
    const store = inject(PlanetStore);
    effect(() => {
      const snapshot = store.snapshot();
      untracked(() => this.compare(snapshot));
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
  }

  private compare(snapshot: PlanetSnapshotDto | null): void {
    if (!snapshot) {
      this.seen = null;
      return;
    }
    const counts = new Map(snapshot.inventory.map((item) => [itemKey(item), item.count]));
    if (this.seen?.planetId === snapshot.id) {
      for (const item of snapshot.inventory) {
        const gained = item.count - (this.seen.counts.get(itemKey(item)) ?? 0);
        if (gained > 0) {
          this.show(`+${gained} ${this.catalogue.itemName(item, gained)}`);
        }
      }
    }
    this.seen = { planetId: snapshot.id, counts };
  }

  private show(text: string): void {
    if (this.waiting) {
      this.waiting.push(text);
      return;
    }
    const receipt = { id: this.nextId++, text };
    this.list.update((list) => [...list, receipt]);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.list.update((list) => list.filter(({ id }) => id !== receipt.id));
    }, RECEIPT_MS);
    this.timers.add(timer);
  }
}

function itemKey({ itemType, kind }: InventoryItemDto): string {
  return `${kind}:${itemType}`;
}
