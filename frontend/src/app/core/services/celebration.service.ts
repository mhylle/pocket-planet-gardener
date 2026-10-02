import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogueService } from './catalogue.service';
import { SyncService } from './sync.service';

/** A short cheer for something new in the catalogue, such as "New in your catalogue: Tulip". */
export interface Celebration {
  id: number;
  text: string;
}

/** How long a celebration shows, in ms; its animation runs for the same time. */
export const CELEBRATION_MS = 3200;

/**
 * Cheers each item type the player gets for the first time (ITM-04 AC3), whichever command
 * brought it: every newlyUnlocked a command response names is celebrated once. Provided by
 * the planet page, so it starts afresh with every planet.
 */
@Injectable()
export class CelebrationService {
  private readonly catalogue = inject(CatalogueService);
  private readonly list = signal<Celebration[]>([]);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly celebrated = new Set<string>();
  private nextId = 1;

  readonly celebrations = this.list.asReadonly();

  constructor() {
    inject(SyncService)
      .newlyUnlocked.pipe(takeUntilDestroyed())
      .subscribe((itemTypes) => this.celebrate(itemTypes));
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
  }

  private celebrate(itemTypes: string[]): void {
    for (const itemType of itemTypes) {
      if (!this.celebrated.has(itemType)) {
        this.celebrated.add(itemType);
        this.show(`New in your catalogue: ${this.catalogue.name(itemType)}`);
      }
    }
  }

  private show(text: string): void {
    const celebration = { id: this.nextId++, text };
    this.list.update((list) => [...list, celebration]);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.list.update((list) => list.filter(({ id }) => id !== celebration.id));
    }, CELEBRATION_MS);
    this.timers.add(timer);
  }
}
