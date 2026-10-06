import { Provider } from '@angular/core';
import { CameraControlsService } from './camera-controls.service';
import { CloudDragController } from './cloud-drag.controller';
import { CreatureMeshService } from './creature-mesh.service';
import { DecorationMeshService } from './decoration-mesh.service';
import { GardenInputService } from './garden-input.service';
import { InputService } from './input.service';
import { PickingService } from './picking.service';
import { PlacementGhostService } from './placement-ghost.service';
import { PlanetMeshService } from './planet-mesh.service';
import { PlantMeshService } from './plant-mesh.service';
import { SceneService } from './scene.service';
import { SelectionRingService } from './selection-ring.service';
import { SkyService } from './sky.service';
import { SunDragController } from './sun-drag.controller';

/**
 * One 3D scene and everything that works on it. Provided by the planet page, so the planet
 * view and the panels around it share the scene, and all of it goes when the page closes.
 * The drawing itself comes from SCENE_RENDERER. The ghost and the garden input also need the
 * page's PlacementService.
 */
export const SCENE_PROVIDERS: Provider[] = [
  SceneService,
  PlanetMeshService,
  CameraControlsService,
  InputService,
  PickingService,
  PlantMeshService,
  DecorationMeshService,
  CreatureMeshService,
  PlacementGhostService,
  GardenInputService,
  SelectionRingService,
  SkyService,
  CloudDragController,
  SunDragController,
];
