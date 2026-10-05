import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  TutorialDto,
  TutorialHighlight,
  TutorialProgressDto,
  TutorialStepDto,
  TutorialStepId,
} from '../models/tutorial';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { ApiService } from './api.service';
import { PlacementService } from './placement.service';
import { PlanetStore } from './planet-store.service';
import { SyncService } from './sync.service';

/** The step number of a finished tutorial. */
export const TUTORIAL_FINISHED = -1;
/** How far the planet must turn, in radians, for the rotate step: 30 degrees. */
export const ROTATE_ANGLE = Math.PI / 6;

/** The command whose success completes each step done by a gameplay command. */
const COMMAND_STEPS = new Map<string, TutorialStepId>([
  ['POST /garden/plants', 'plant'],
  ['POST /garden/rain', 'water'],
  ['POST /garden/sun', 'move-sun'],
]);

/**
 * Pip's tutorial (ONB-01): which step the player is on, and when it is done. The steps come
 * from the server once; the step reached comes from the planet's snapshot when it opens, so a
 * reload carries on where the player was (AC4). Each step is done by doing what it asks while
 * it is the step shown: turning the planet, choosing an inventory item, planting, raining,
 * moving the sun, opening a plant's card, or Pip's own buttons. Doing a later step's action
 * early does not count (AC2). Every step reached is saved; after the last one the tutorial is
 * finished and can be started again. Provided by the planet page, which owns what it watches.
 */
@Injectable()
export class TutorialService {
  private readonly api = inject(ApiService);
  private readonly store = inject(PlanetStore);
  private readonly placement = inject(PlacementService);

  private readonly script = signal<TutorialStepDto[]>([]);
  private readonly reached = signal<number | null>(null);
  private readonly planetId = computed(() => this.store.snapshot()?.id ?? null);
  /** How far the planet has turned since the current step began, in radians. */
  private turnedSince = 0;
  /** The step saves, one after the other, so the server hears them in order. */
  private saving: Promise<void> = Promise.resolve();

  readonly steps = this.script.asReadonly();
  /** The step's number, TUTORIAL_FINISHED once done, or null before a planet is loaded. */
  readonly step = this.reached.asReadonly();
  /** The step shown now; null when finished or not loaded yet. */
  readonly current = computed(() => this.script()[this.reached() ?? TUTORIAL_FINISHED] ?? null);
  /** True once every step was done, so Pip waits as a help button (AC3). */
  readonly finished = computed(
    () => this.reached() === TUTORIAL_FINISHED && this.script().length > 0,
  );
  /**
   * What Pip points at now. A card shows only once something is tapped, so until then Pip
   * points at the planet.
   */
  readonly highlight = computed<TutorialHighlight>(() => {
    const target = this.current()?.highlight ?? 'none';
    const cardShown = this.placement.card() !== null || this.placement.hoverCard() !== null;
    return target === 'card' && !cardShown ? 'canvas' : target;
  });

  constructor() {
    this.api
      .get<TutorialDto>('/tutorial')
      .pipe(takeUntilDestroyed())
      // Without the script there is no Pip; the game itself works on.
      .subscribe({ next: ({ steps }) => this.script.set(steps), error: () => undefined });

    // A planet that opens carries on from the step it reached.
    effect(() => {
      const id = this.planetId();
      untracked(() => this.begin(id ? this.store.snapshot()!.tutorialStep : null));
    });

    // Each watcher reacts only to a change, so something done before its step began never
    // completes it.
    inject(CameraControlsService)
      .turned.pipe(takeUntilDestroyed())
      .subscribe((angle) => {
        if (this.current()?.id === 'rotate') {
          this.turnedSince += angle;
          if (this.turnedSince >= ROTATE_ANGLE) {
            this.complete('rotate');
          }
        }
      });
    effect(() => {
      if (this.placement.selected()?.mode === 'place') {
        untracked(() => this.complete('open-inventory'));
      }
    });
    effect(() => {
      if (this.placement.card()?.kind === 'plant') {
        untracked(() => this.complete('inspect'));
      }
    });
    inject(SyncService)
      .applied.pipe(takeUntilDestroyed())
      .subscribe(({ method, path }) => {
        const id = COMMAND_STEPS.get(`${method} ${path}`);
        if (id) {
          this.complete(id);
        }
      });
  }

  /**
   * The player did what the step asks, such as choosing "Let's go". Moves on, and saves the
   * new step, only when that step is the one shown.
   */
  complete(id: TutorialStepId): void {
    const steps = this.script();
    const index = this.reached();
    if (index === null || steps[index]?.id !== id) {
      return;
    }
    const next = index + 1 < steps.length ? index + 1 : TUTORIAL_FINISHED;
    this.begin(next);
    this.save(next);
  }

  /** Starts the finished tutorial again from the welcome (ONB-03 AC2). */
  restart(): void {
    if (this.finished()) {
      this.begin(0);
      this.save(0);
    }
  }

  private begin(step: number | null): void {
    this.reached.set(step);
    this.turnedSince = 0;
  }

  private save(step: number): void {
    this.saving = this.saving
      .then(() => firstValueFrom(this.api.patch<TutorialProgressDto>('/planet/tutorial', { step })))
      // An unsaved step only matters on a reload, which then repeats it; the next one saves on.
      .then(() => undefined, () => undefined);
  }
}
