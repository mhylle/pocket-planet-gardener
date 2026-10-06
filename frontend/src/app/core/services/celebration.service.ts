import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlanetSnapshotDto } from '../models/planet-snapshot';
import { AudioService, SoundCue } from './audio.service';
import { CatalogueService } from './catalogue.service';
import { PlanetStore } from './planet-store.service';
import { SyncService } from './sync.service';

/**
 * A short cheer for something new, such as "New in your catalogue: Tulip" or "Mira the moth
 * moved in!".
 */
export interface Celebration {
  id: number;
  text: string;
}

/** How long a celebration shows, in ms; its animation runs for the same time. */
export const CELEBRATION_MS = 3200;

/**
 * Cheers each item type the player gets for the first time (ITM-04 AC3), whichever command
 * brought it: every newlyUnlocked a command response names is celebrated once. Also cheers
 * each creature that moves in (CRT-01 AC1): one the previous snapshot of the same planet did
 * not have, so the creatures already there when the planet opens are not cheered. Each cheer
 * comes with its sound. Provided by the planet page, so it starts afresh with every planet.
 */
@Injectable()
export class CelebrationService {
  private readonly catalogue = inject(CatalogueService);
  private readonly audio = inject(AudioService);
  private readonly list = signal<Celebration[]>([]);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly celebrated = new Set<string>();
  private seen: { planetId: string; creatureIds: Set<string> } | null = null;
  private nextId = 1;

  readonly celebrations = this.list.asReadonly();

  constructor() {
    inject(SyncService)
      .newlyUnlocked.pipe(takeUntilDestroyed())
      .subscribe((itemTypes) => this.celebrate(itemTypes));
    const store = inject(PlanetStore);
    effect(() => {
      const snapshot = store.snapshot();
      untracked(() => this.welcome(snapshot));
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
  }

  private welcome(snapshot: PlanetSnapshotDto | null): void {
    if (!snapshot) {
      this.seen = null;
      return;
    }
    if (this.seen?.planetId === snapshot.id) {
      for (const { id, name, species } of snapshot.creatures) {
        if (!this.seen.creatureIds.has(id)) {
          const text = `${name} the ${this.catalogue.name(species).toLowerCase()} moved in!`;
          this.show(text, 'arrival');
        }
      }
    }
    this.seen = {
      planetId: snapshot.id,
      creatureIds: new Set(snapshot.creatures.map(({ id }) => id)),
    };
  }

  private celebrate(itemTypes: string[]): void {
    for (const itemType of itemTypes) {
      if (!this.celebrated.has(itemType)) {
        this.celebrated.add(itemType);
        this.show(`New in your catalogue: ${this.catalogue.name(itemType)}`, 'celebration');
      }
    }
  }

  private show(text: string, cue: SoundCue): void {
    this.audio.play(cue);
    const celebration = { id: this.nextId++, text };
    this.list.update((list) => [...list, celebration]);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.list.update((list) => list.filter(({ id }) => id !== celebration.id));
    }, CELEBRATION_MS);
    this.timers.add(timer);
  }
}
