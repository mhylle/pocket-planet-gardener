import { Injectable, inject } from '@angular/core';
import * as THREE from 'three';
import { SurfacePoint, fromVector } from '../core/helpers/surface-coords';
import { SceneService } from './scene.service';

export type PickKind = 'planet' | 'plant' | 'decoration' | 'creature' | 'cloud' | 'sun';

/** What a pickable object stands for. */
export interface PickTarget {
  kind: PickKind;
  id?: string;
}

/** What a tap landed on. */
export interface PickResult extends PickTarget {
  /** The surface point under the hit, in the planet's own coordinates, so turning does not matter. */
  surface?: SurfacePoint;
}

/**
 * Finds what is under a point on the canvas. Only registered objects (and their children) can
 * be picked; the nearest one along the camera ray wins.
 */
@Injectable()
export class PickingService {
  private readonly sceneService = inject(SceneService);
  private readonly targets = new Map<THREE.Object3D, PickTarget>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  register(object: THREE.Object3D, target: PickTarget): void {
    this.targets.set(object, target);
  }

  unregister(object: THREE.Object3D): void {
    this.targets.delete(object);
  }

  /** The object under a canvas point given in CSS pixels from its top left; null for open sky. */
  pick({ x, y }: { x: number; y: number }): PickResult | null {
    const { scene, camera, planetGroup, width, height } = this.sceneService;
    // The renderer updates these while drawing, but a tap may come before the next frame.
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    this.pointer.set((x / width) * 2 - 1, 1 - (y / height) * 2);
    this.raycaster.setFromCamera(this.pointer, camera);
    const [hit] = this.raycaster.intersectObjects([...this.targets.keys()], true);
    const target = hit && this.targetOf(hit.object);
    if (!target) {
      return null;
    }
    return { ...target, surface: fromVector(planetGroup.worldToLocal(hit.point.clone())) };
  }

  /** The target of the object itself or of its nearest registered ancestor. */
  private targetOf(object: THREE.Object3D): PickTarget | undefined {
    for (let current: THREE.Object3D | null = object; current; current = current.parent) {
      const target = this.targets.get(current);
      if (target) {
        return target;
      }
    }
    return undefined;
  }
}
