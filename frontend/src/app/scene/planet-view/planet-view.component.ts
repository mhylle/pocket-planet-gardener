import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { CameraControlsService } from '../camera-controls.service';
import { InputService } from '../input.service';
import { PlanetMeshService } from '../planet-mesh.service';
import { SceneService } from '../scene.service';

/**
 * The canvas the 3D planet is drawn on. Starts the scene once the canvas is in the page and
 * frees it when the view closes. The scene services come from the page around it
 * (SCENE_PROVIDERS).
 */
@Component({
  selector: 'app-planet-view',
  templateUrl: './planet-view.component.html',
  styleUrl: './planet-view.component.scss',
})
export class PlanetViewComponent {
  readonly name = input.required<string>();
  readonly radiusLevel = input.required<number>();

  protected readonly label = computed(
    () =>
      `${this.name()}, your planet. ` +
      'Drag or use the arrow keys to turn it; scroll or press plus and minus to zoom. ' +
      'Drag a cloud to water, or the sun to light; Tab reaches them by keyboard.',
  );

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const scene = inject(SceneService);
    const planetMesh = inject(PlanetMeshService);
    const input = inject(InputService);
    // Created now so it listens to the input from the first gesture.
    inject(CameraControlsService);

    effect(() => planetMesh.setRadiusLevel(this.radiusLevel()));
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      input.connect(canvas);
      scene.attach(canvas);
    });
    inject(DestroyRef).onDestroy(() => {
      input.disconnect();
      scene.dispose();
    });
  }
}
