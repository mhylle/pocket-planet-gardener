import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlanetStore } from '../core/services/planet-store.service';
import { SyncService } from '../core/services/sync.service';
import { InputService, TapInput } from './input.service';
import { PickingService } from './picking.service';
import { planetRadius } from './planet-mesh.service';
import { SUN_DISTANCE, SkyService } from './sky.service';

/** The least time between two sun commands, so at most two go out a second. */
export const SUN_SEND_MS = 500;

/**
 * Moving the sun (GRD-03 AC1). A press on the sun grabs it, and dragging puts it over the
 * longitude under the pointer. The sun and its light move at once; the server hears the angle
 * at most twice a second while it changes, and once more on letting go when the last angle
 * has not gone out yet. The keyboard moves it with nudge() and flush(). Once nothing is on its
 * way, the sun follows the snapshot again, which holds it for a while (AC2).
 */
@Injectable()
export class SunDragController {
  private readonly sky = inject(SkyService);
  private readonly sync = inject(SyncService);
  private readonly picking = inject(PickingService);
  private readonly store = inject(PlanetStore);
  private readonly input = inject(InputService);

  private dragging = false;
  /** The angle set last that the server has not heard yet; null when it has. */
  private unsent: number | null = null;
  private lastSentAt = -Infinity;
  private trailing: ReturnType<typeof setTimeout> | null = null;
  private inFlight = 0;

  constructor() {
    this.input.pressStart.pipe(takeUntilDestroyed()).subscribe((at) => this.press(at));
    this.input.grabMove.pipe(takeUntilDestroyed()).subscribe((at) => this.follow(at));
    this.input.grabEnd.pipe(takeUntilDestroyed()).subscribe(() => this.release());
    inject(DestroyRef).onDestroy(() => this.cancelTrailing());
  }

  /** Puts the sun over the longitude in degrees now; the server hears it soon. */
  setAngle(angle: number): void {
    const normalised = ((angle % 360) + 360) % 360;
    this.sky.holdSun(normalised);
    this.unsent = normalised;
    if (this.trailing !== null) {
      return;
    }
    const wait = this.lastSentAt + SUN_SEND_MS - Date.now();
    if (wait <= 0) {
      this.sendNow();
    } else {
      this.trailing = setTimeout(() => {
        this.trailing = null;
        this.sendNow();
      }, wait);
    }
  }

  /** Moves the sun east by degrees, or west when negative. */
  nudge(east: number): void {
    this.setAngle(this.sky.sunAngle() + east);
  }

  /** Sends the last angle now if it has not gone out yet. */
  flush(): void {
    this.cancelTrailing();
    this.sendNow();
    this.settle();
  }

  /** A press on the sun grabs it. */
  private press(at: TapInput): void {
    if (this.picking.pick(at)?.kind === 'sun') {
      this.input.grab();
      this.dragging = true;
    }
  }

  /** The sun stands over the longitude under the pointer, on its own sphere. */
  private follow(at: TapInput): void {
    if (!this.dragging) {
      return;
    }
    const radius = planetRadius(this.store.snapshot()?.radiusLevel ?? 1);
    const point = this.picking.sphereAt(at, radius * SUN_DISTANCE, { orNearest: true });
    if (point) {
      this.setAngle(point.lon);
    }
  }

  private release(): void {
    if (this.dragging) {
      this.dragging = false;
      this.flush();
    }
  }

  private sendNow(): void {
    const angle = this.unsent;
    if (angle === null) {
      return;
    }
    this.unsent = null;
    this.lastSentAt = Date.now();
    this.inFlight++;
    this.sync
      .send({ method: 'POST', path: '/garden/sun', body: { angle } })
      // A refused move leaves the sun where the server has it; a conflict has its own banner.
      .catch(() => undefined)
      .finally(() => {
        this.inFlight--;
        this.settle();
      });
  }

  /** Once nothing is held, waiting or on its way, the sun stands where the snapshot says. */
  private settle(): void {
    if (!this.dragging && this.trailing === null && this.unsent === null && this.inFlight === 0) {
      this.sky.letGoSun();
    }
  }

  private cancelTrailing(): void {
    if (this.trailing !== null) {
      clearTimeout(this.trailing);
      this.trailing = null;
    }
  }
}
