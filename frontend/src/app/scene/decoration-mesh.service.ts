import { Injectable, effect, inject } from '@angular/core';
import * as THREE from 'three';
import { PlanetStore } from '../core/services/planet-store.service';
import { decorationModel } from './garden-models';
import { PickingService } from './picking.service';
import { planetRadius } from './planet-mesh.service';
import { SceneService } from './scene.service';
import { SurfaceItemLayer } from './surface-item-layer';

/**
 * The decorations on the planet (pond, rock, lamp-post, bench, tiny house), drawn from the
 * snapshot: one instanced mesh per type, each pickable as a 'decoration' with its id.
 * Redraws whenever the snapshot's decorations change.
 */
@Injectable()
export class DecorationMeshService {
  private readonly layer = new SurfaceItemLayer(
    'decoration',
    inject(SceneService).planetGroup,
    inject(PickingService),
    decorationModel,
  );

  constructor() {
    const scene = inject(SceneService);
    const store = inject(PlanetStore);
    effect(() => {
      const snapshot = store.snapshot();
      const items = (snapshot?.decorations ?? []).map(({ id, type, lat, lon }) => ({
        id,
        model: type,
        point: { lat, lon },
      }));
      if (this.layer.draw(items, planetRadius(snapshot?.radiusLevel ?? 1))) {
        scene.requestRender();
      }
    });
  }

  /** The meshes drawn now, one per decoration type in use. */
  get meshes(): readonly THREE.InstancedMesh[] {
    return this.layer.meshes;
  }
}
