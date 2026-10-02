import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EventDto } from '../models/planet-snapshot';
import { GiftReceivedPayload, RewardItem, WantFulfilledPayload } from '../models/want';
import { CatalogueService } from './catalogue.service';
import { ReceiptService } from './receipt.service';
import { SyncService } from './sync.service';

/** What a creature hands over, shown before it goes into the inventory. */
export interface RewardReveal {
  id: number;
  creatureId: string;
  /** The creature's thank-you line for a fulfilled want; null for a gift. */
  thankYou: string | null;
  /** Such as "Mira gives you:" or "Mira has a present for you:". */
  lead: string;
  /** Such as "2 × Tulip seeds", one per item. */
  items: string[];
}

/**
 * Shows each reward for a fulfilled want with the creature's thank-you (WNT-03 AC1, WNT-04
 * AC1), and each present from an overjoyed creature (CRT-04 AC2), from the events of any
 * command or sync response. One shows at a time, in the order they came. While any is waiting,
 * the inventory receipts are held, so the items are shown before they go into the inventory;
 * dismissing the last one lets the receipts through. Provided by the planet page.
 */
@Injectable()
export class RewardRevealService {
  private readonly catalogue = inject(CatalogueService);
  private readonly receipts = inject(ReceiptService);
  private readonly queue = signal<RewardReveal[]>([]);
  private nextId = 1;

  /** The reveal to show now; null when none is waiting. */
  readonly current = computed(() => this.queue()[0] ?? null);

  constructor() {
    inject(SyncService)
      .events.pipe(takeUntilDestroyed())
      .subscribe((events) => events.forEach((event) => this.reveal(event)));
  }

  /** Closes the current reveal; the next one shows, or the held receipts once none is left. */
  dismiss(): void {
    this.queue.update(([, ...rest]) => rest);
    if (this.queue().length === 0) {
      this.receipts.release();
    }
  }

  private reveal({ type, payload }: EventDto): void {
    if (type === 'want-fulfilled') {
      const { creatureId, name, thankYou, reward } = payload as unknown as WantFulfilledPayload;
      this.add(creatureId, thankYou, `${name} gives you:`, reward);
    } else if (type === 'gift-received') {
      const { creatureId, name, item } = payload as unknown as GiftReceivedPayload;
      this.add(creatureId, null, `${name} has a present for you:`, [item]);
    }
  }

  private add(
    creatureId: string,
    thankYou: string | null,
    lead: string,
    items: RewardItem[],
  ): void {
    this.receipts.hold();
    const reveal: RewardReveal = {
      id: this.nextId++,
      creatureId,
      thankYou,
      lead,
      items: items.map((item) => `${item.count} × ${this.catalogue.itemName(item, item.count)}`),
    };
    this.queue.update((queue) => [...queue, reveal]);
  }
}
