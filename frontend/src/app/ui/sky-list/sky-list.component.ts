import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MIN_RAIN_WATER } from '../../core/helpers/cloud-rules';
import { STEP_ARC, SurfacePoint, stepsBetween } from '../../core/helpers/surface-coords';
import { GameConfigService } from '../../core/services/game-config.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { CloudDragController } from '../../scene/cloud-drag.controller';
import { SceneService } from '../../scene/scene.service';
import { SkyService, SkyTarget } from '../../scene/sky.service';
import { SunDragController } from '../../scene/sun-drag.controller';

export type SkyIcon = 'full' | 'half' | 'low' | 'empty' | 'rain' | 'sun';

/** One step across the surface, in degrees: how far an arrow key moves a cloud. */
const CLOUD_STEP_DEGREES = (STEP_ARC * 180) / Math.PI;
/** How far an arrow key moves the sun, in degrees. */
export const SUN_STEP_DEGREES = 10;

const CLOUD_MOVES: Record<string, { north: number; east: number; towards: string }> = {
  ArrowUp: { north: CLOUD_STEP_DEGREES, east: 0, towards: 'north' },
  ArrowDown: { north: -CLOUD_STEP_DEGREES, east: 0, towards: 'south' },
  ArrowRight: { north: 0, east: CLOUD_STEP_DEGREES, towards: 'east' },
  ArrowLeft: { north: 0, east: -CLOUD_STEP_DEGREES, towards: 'west' },
};
const SUN_MOVES: Record<string, { east: number; towards: string }> = {
  ArrowRight: { east: SUN_STEP_DEGREES, towards: 'east' },
  ArrowLeft: { east: -SUN_STEP_DEGREES, towards: 'west' },
};

/** A cloud's state in words, each with its own icon, never colour alone (SET-04). */
export function cloudStatus(water: number, raining: boolean): { text: string; icon: SkyIcon } {
  if (raining) {
    return { text: 'raining', icon: 'rain' };
  }
  if (water >= 0.9) {
    return { text: 'full', icon: 'full' };
  }
  if (water >= 0.4) {
    return { text: 'half full', icon: 'half' };
  }
  // Too little to rain with: it rests and refills (GRD-02 AC2).
  return water >= MIN_RAIN_WATER ? { text: 'low', icon: 'low' } : { text: 'empty', icon: 'empty' };
}

interface SkyOption {
  key: string;
  target: SkyTarget;
  name: string;
  icon: SkyIcon;
  status: string | null;
}

/**
 * The clouds and the sun for the keyboard (GRD-02 AC4, SET-05): a listbox next after the
 * canvas, one Tab stop per object. The focused one is selected, outlined in the scene and,
 * for a cloud, held and turned into view. Arrow keys move it (a cloud one step, the sun ten
 * degrees), Space starts and stops a cloud's rain, Escape lets go and goes back to the
 * canvas. A hidden live region says what each key did.
 */
@Component({
  selector: 'app-sky-list',
  templateUrl: './sky-list.component.html',
  styleUrl: './sky-list.component.scss',
})
export class SkyListComponent {
  private readonly sky = inject(SkyService);
  private readonly cloudDrag = inject(CloudDragController);
  private readonly sunDrag = inject(SunDragController);
  private readonly scene = inject(SceneService);
  private readonly camera = inject(CameraControlsService);
  private readonly store = inject(PlanetStore);
  private readonly config = inject(GameConfigService).config;

  protected readonly selected = signal<string | null>(null);
  protected readonly announcement = signal('');
  protected readonly options = computed<SkyOption[]>(() => {
    const held = this.cloudDrag.held();
    const raining = this.cloudDrag.raining();
    const clouds = this.sky.clouds().map((cloud): SkyOption => {
      const { text, icon } = cloudStatus(cloud.water, raining && held === cloud.id);
      const target: SkyTarget = { kind: 'cloud', id: cloud.id };
      return { key: cloud.id, target, name: cloud.name, icon, status: text };
    });
    return [
      ...clouds,
      { key: 'sun', target: { kind: 'sun' }, name: 'Sun', icon: 'sun', status: null },
    ];
  });

  constructor() {
    this.cloudDrag.ranDry
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.announce(`${this.sky.cloud(id)?.name ?? 'The cloud'} is empty`));
  }

  protected focus({ key, target }: SkyOption): void {
    this.selected.set(key);
    this.sky.select(target);
    if (target.kind === 'cloud' && this.cloudDrag.grab(target.id)) {
      this.camera.focusOn(this.sky.cloud(target.id)!);
    }
  }

  protected blur(option: SkyOption): void {
    if (this.selected() === option.key) {
      this.selected.set(null);
      this.sky.select(null);
    }
    this.letGo(option);
  }

  protected key(event: KeyboardEvent, option: SkyOption): void {
    if (event.key.startsWith('Arrow')) {
      // The page would scroll as well.
      event.preventDefault();
      this.move(option, event.key);
    } else if (event.key === ' ' && option.target.kind === 'cloud') {
      event.preventDefault();
      this.toggleRain(option.target.id, option.name);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.letGo(option);
      this.announce(`${option.name} let go`);
      this.scene.focusCanvas();
    }
  }

  private move({ target, name }: SkyOption, key: string): void {
    if (target.kind === 'sun') {
      const move = SUN_MOVES[key];
      if (move) {
        this.sunDrag.nudge(move.east);
        this.announce(`Sun moved ${move.towards}`);
      }
      return;
    }
    const move = CLOUD_MOVES[key];
    if (!move || !this.cloudDrag.grab(target.id)) {
      return;
    }
    this.cloudDrag.moveBy(move.north, move.east);
    const cloud = this.sky.cloud(target.id)!;
    this.camera.focusOn(cloud);
    this.announce(`${name} moved ${move.towards}. ${this.plantsBelow(cloud)}`);
  }

  private toggleRain(id: string, name: string): void {
    if (!this.cloudDrag.grab(id)) {
      return;
    }
    const raining = !this.cloudDrag.raining();
    this.cloudDrag.setRaining(raining);
    this.announce(raining ? `${name} raining` : `${name} stopped raining`);
  }

  /** Lets go of what the option stands for, unless the pointer has taken something else. */
  private letGo({ target }: SkyOption): void {
    if (target.kind === 'sun') {
      this.sunDrag.flush();
    } else if (this.cloudDrag.held() === target.id) {
      void this.cloudDrag.release();
    }
  }

  /** How many plants the rain from a cloud over the point would reach. */
  private plantsBelow(point: SurfacePoint): string {
    const reach = this.config().rainRadiusSteps;
    const plants = this.store.snapshot()?.plants ?? [];
    const count = plants.filter((plant) => stepsBetween(plant, point) <= reach).length;
    return count === 1 ? '1 plant below.' : `${count || 'No'} plants below.`;
  }

  private announce(text: string): void {
    // The same words twice in a row would not be read out again, so a repeat differs unseen.
    this.announcement.update((previous) => (previous === text ? `${text} ` : text));
  }
}
