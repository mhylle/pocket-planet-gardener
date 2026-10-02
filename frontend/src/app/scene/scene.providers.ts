import { Provider } from '@angular/core';
import { CameraControlsService } from './camera-controls.service';
import { InputService } from './input.service';
import { PickingService } from './picking.service';
import { PlanetMeshService } from './planet-mesh.service';
import { SceneService } from './scene.service';

/**
 * One 3D scene and everything that works on it. Provided by the planet page, so the planet
 * view and the panels around it share the scene, and all of it goes when the page closes.
 * The drawing itself comes from SCENE_RENDERER.
 */
export const SCENE_PROVIDERS: Provider[] = [
  SceneService,
  PlanetMeshService,
  CameraControlsService,
  InputService,
  PickingService,
];
