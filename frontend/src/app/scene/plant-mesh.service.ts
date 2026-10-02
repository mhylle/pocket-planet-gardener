import { Injectable, effect, inject } from '@angular/core';
import * as THREE from 'three';
import { PlantStage } from '../core/models/planet-snapshot';
import { PlanetStore } from '../core/services/planet-store.service';
import { plantModel } from './garden-models';
import { PickingService } from './picking.service';
import { planetRadius } from './planet-mesh.service';
import { SceneService } from './scene.service';
import { SurfaceItemLayer } from './surface-item-layer';

/**
 * The plants on the planet, drawn from the snapshot: one instanced mesh per plant type and
 * stage, each plant upright on its surface point and pickable as a 'plant' with its id.
 * Redraws whenever the snapshot's plants change.
 */
@Injectable()
export class PlantMeshService {
  private readonly layer = new SurfaceItemLayer(
    'plant',
    inject(SceneService).planetGroup,
    inject(PickingService),
    (model) => {
      const [type, stage] = model.split('/');
      return plantModel(type, stage as PlantStage);
    },
  );

  constructor() {
    const scene = inject(SceneService);
    const store = inject(PlanetStore);
    effect(() => {
      const snapshot = store.snapshot();
      const items = (snapshot?.plants ?? []).map(({ id, type, stage, lat, lon }) => ({
        id,
        model: `${type}/${stage}`,
        point: { lat, lon },
      }));
      if (this.layer.draw(items, planetRadius(snapshot?.radiusLevel ?? 1))) {
        scene.requestRender();
      }
    });
  }

  /** The meshes drawn now, one per plant type and stage in use. */
  get meshes(): readonly THREE.InstancedMesh[] {
    return this.layer.meshes;
  }
}
