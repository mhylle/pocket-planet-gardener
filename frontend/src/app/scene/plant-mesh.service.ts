import { Injectable, effect, inject, untracked } from '@angular/core';
import * as THREE from 'three';
import { presentPlant } from '../core/helpers/plant-presenter';
import { PlantStage } from '../core/models/planet-snapshot';
import { MotionPreferenceService } from '../core/services/motion-preference.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { bloomHeight, plantModel } from './garden-models';
import { PickingService } from './picking.service';
import { planetRadius } from './planet-mesh.service';
import { SceneService } from './scene.service';
import { SparklingPlant, Sparkles } from './sparkles';
import { SurfaceItem, SurfaceItemLayer } from './surface-item-layer';

/** How far a thirsty plant leans over, in radians, and the duller colour it takes on. */
export const DROOP_LEAN = 0.3;
export const DROOP_TINT = '#c4b48c';

/**
 * The plants on the planet, drawn from the snapshot: one instanced mesh per plant type and
 * stage, each plant upright on its surface point and pickable as a 'plant' with its id. A
 * thirsty plant droops (GRD-04 AC3); a bloom with seeds ready sparkles, and the sparkles
 * twinkle unless motion is reduced (GRD-08 AC1). Redraws whenever the snapshot's plants change.
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
  private readonly sparkles = new Sparkles(
    inject(SceneService).planetGroup,
    inject(PickingService),
  );

  constructor() {
    const scene = inject(SceneService);
    const store = inject(PlanetStore);
    effect(() => {
      const snapshot = store.snapshot();
      const radius = planetRadius(snapshot?.radiusLevel ?? 1);
      const items: SurfaceItem[] = [];
      const sparkling: SparklingPlant[] = [];
      for (const plant of snapshot?.plants ?? []) {
        const { stage, droop, sparkle } = presentPlant(plant);
        const item: SurfaceItem = {
          id: plant.id,
          model: `${plant.type}/${stage}`,
          point: { lat: plant.lat, lon: plant.lon },
          ...(droop ? { lean: DROOP_LEAN, tint: DROOP_TINT } : {}),
        };
        items.push(item);
        if (sparkle) {
          sparkling.push({ ...item, height: bloomHeight(plant.type) });
        }
      }
      const plantsChanged = this.layer.draw(items, radius);
      const sparklesChanged = this.sparkles.draw(sparkling, radius);
      if (plantsChanged || sparklesChanged) {
        scene.requestRender();
      }
    });

    // A change of the motion setting holds the sparkles still, or wakes the frames to twinkle.
    const reduced = inject(MotionPreferenceService).reduced;
    effect(() => {
      reduced();
      untracked(() => {
        this.sparkles.twinkle(null);
        scene.requestRender();
      });
    });
    let seconds = 0;
    scene.onFrame((dt) => {
      if (!reduced() && this.sparkles.mesh) {
        seconds += dt;
        this.sparkles.twinkle(seconds);
        // Keeps drawing while anything sparkles; the loop rests once nothing does.
        scene.requestRender();
      }
    });
  }

  /** The meshes drawn now, one per plant type and stage in use. */
  get meshes(): readonly THREE.InstancedMesh[] {
    return this.layer.meshes;
  }

  /** The sparkles over blooms with seeds ready, one instance per sparkle; null when none. */
  get sparkleMesh(): THREE.InstancedMesh | null {
    return this.sparkles.mesh;
  }
}
