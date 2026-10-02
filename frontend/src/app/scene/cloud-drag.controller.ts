import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';
import { SurfacePoint } from '../core/helpers/surface-coords';
import { RainResponse } from '../core/models/planet-snapshot';
import { PlanetStore } from '../core/services/planet-store.service';
import { SyncService } from '../core/services/sync.service';
import { InputService, TapInput } from './input.service';
import { PickingService } from './picking.service';
import { planetRadius } from './planet-mesh.service';
import { SkyService } from './sky.service';

/** How often a raining cloud reports its rain, and how many seconds each report covers. */
export const RAIN_REPORT_MS = 1000;
const RAIN_SECONDS_PER_REPORT = 1;
/** Clouds are kept off the poles, where moving east or west means nothing. */
const MAX_LAT = 80;

/** The cloud the player holds. */
interface Hold {
  id: string;
  point: SurfacePoint;
  /** False while a pointer holds it out over open sky; it stays where it was, dry. */
  overSurface: boolean;
  raining: boolean;
  /** Moved or rained since it was picked up, so letting go must tell the server where it is. */
  changed: boolean;
  timer: ReturnType<typeof setInterval>;
}

/**
 * Picking up clouds, raining with them and letting go (GRD-02). A press on a cloud grabs it,
 * so the drag moves the cloud instead of turning the planet: it follows the pointer over the
 * surface and rains there, reporting one second of rain every second. The keyboard holds a
 * cloud through grab(), moveBy() and toggleRain() instead. Letting go tells the server where
 * the cloud is, and it drifts on from there (AC3). A cloud that runs dry stops raining (AC2).
 */
@Injectable()
export class CloudDragController {
  private readonly sky = inject(SkyService);
  private readonly sync = inject(SyncService);
  private readonly picking = inject(PickingService);
  private readonly store = inject(PlanetStore);
  private readonly input = inject(InputService);

  private hold: Hold | null = null;
  private readonly heldId = signal<string | null>(null);
  private readonly isRaining = signal(false);
  private readonly emptied = new Subject<string>();

  /** The id of the cloud held now; null for none. */
  readonly held = this.heldId.asReadonly();
  /** True while the held cloud rains (or would, once back over the surface). */
  readonly raining = this.isRaining.asReadonly();
  /** The id of a held cloud that just ran dry and stopped raining. */
  readonly ranDry: Observable<string> = this.emptied.asObservable();

  constructor() {
    this.input.pressStart.pipe(takeUntilDestroyed()).subscribe((at) => this.press(at));
    this.input.grabMove.pipe(takeUntilDestroyed()).subscribe((at) => this.follow(at));
    this.input.grabEnd.pipe(takeUntilDestroyed()).subscribe(() => void this.release());
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  /** Picks up the cloud where it is now; one held before is let go. False for an unknown id. */
  grab(id: string): boolean {
    const cloud = this.sky.cloud(id);
    if (!cloud) {
      return false;
    }
    if (this.hold?.id !== id) {
      void this.release();
      this.hold = {
        id,
        point: { lat: cloud.lat, lon: cloud.lon },
        overSurface: true,
        raining: false,
        changed: false,
        timer: setInterval(() => this.reportRain(), RAIN_REPORT_MS),
      };
      this.heldId.set(id);
      this.sky.holdCloud(id, this.hold.point);
    }
    return true;
  }

  /** Moves the held cloud by degrees north and east, keeping it off the poles. */
  moveBy(north: number, east: number): void {
    const hold = this.hold;
    if (hold) {
      const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, hold.point.lat + north));
      this.moveTo({ lat, lon: wrapLon(hold.point.lon + east) });
    }
  }

  /** Starts or stops the held cloud's rain. */
  setRaining(raining: boolean): void {
    const hold = this.hold;
    if (!hold) {
      return;
    }
    hold.raining = raining;
    this.isRaining.set(raining);
    this.sky.setRaining(hold.id, raining && hold.overSurface);
  }

  /**
   * Lets go of the held cloud. When it moved or rained, the server hears where it is and it
   * drifts on from there; until then it stays put, so it never jumps back.
   */
  async release(): Promise<void> {
    const hold = this.hold;
    if (!hold) {
      return;
    }
    this.setRaining(false);
    this.stopTimer();
    this.hold = null;
    this.heldId.set(null);
    if (hold.changed) {
      const { lat, lon } = hold.point;
      await this.sync
        .send({
          method: 'POST',
          path: `/garden/clouds/${encodeURIComponent(hold.id)}/position`,
          body: { lat, lon },
        })
        // A refused move leaves the cloud drifting where the server has it.
        .catch(() => undefined);
    }
    // Grabbed again meanwhile: the new hold keeps it.
    if (this.heldId() !== hold.id) {
      this.sky.letGoCloud(hold.id);
    }
  }

  /** A press on a cloud grabs it and starts its rain. */
  private press(at: TapInput): void {
    const hit = this.picking.pick(at);
    if (hit?.kind === 'cloud' && hit.id && this.grab(hit.id)) {
      this.input.grab();
      this.setRaining(true);
    }
  }

  /** The cloud follows the pointer over the surface; over open sky it waits where it was. */
  private follow(at: TapInput): void {
    const hold = this.hold;
    if (!hold) {
      return;
    }
    const radius = planetRadius(this.store.snapshot()?.radiusLevel ?? 1);
    const point = this.picking.sphereAt(at, radius);
    if (point) {
      this.moveTo(point);
    } else {
      hold.overSurface = false;
      this.sky.setRaining(hold.id, false);
    }
  }

  private moveTo(point: SurfacePoint): void {
    const hold = this.hold!;
    hold.point = point;
    hold.overSurface = true;
    hold.changed = true;
    this.sky.holdCloud(hold.id, point);
    this.sky.setRaining(hold.id, hold.raining);
  }

  /** Tells the server about the last second of rain from the held cloud, if it rained. */
  private reportRain(): void {
    const hold = this.hold;
    if (!hold?.raining || !hold.overSurface) {
      return;
    }
    hold.changed = true;
    const { id, point } = hold;
    this.sync
      .send({
        method: 'POST',
        path: '/garden/rain',
        body: { cloudId: id, lat: point.lat, lon: point.lon, seconds: RAIN_SECONDS_PER_REPORT },
      })
      .then((response) => {
        if ((response as RainResponse).cloudEmpty && this.hold === hold && hold.raining) {
          this.setRaining(false);
          this.emptied.next(id);
        }
      })
      // A refused rain changes nothing; a conflict has its own banner.
      .catch(() => undefined);
  }

  private stopTimer(): void {
    if (this.hold) {
      clearInterval(this.hold.timer);
    }
  }
}

/** A longitude brought into (-180, 180], the range the server accepts. */
function wrapLon(lon: number): number {
  return 180 - ((((180 - lon) % 360) + 360) % 360);
}
