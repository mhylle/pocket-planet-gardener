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
 * be picked; the nearest one along the camera ray wins. An InstancedMesh may stand for one
 * target per instance, such as one plant each.
 */
@Injectable()
export class PickingService {
  private readonly sceneService = inject(SceneService);
  private readonly targets = new Map<THREE.Object3D, PickTarget | readonly PickTarget[]>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  /**
   * The registered objects, and the hits of the last ray, kept between picks: the garden input
   * picks on every frame while the planet turns under the pointer.
   */
  private objects: THREE.Object3D[] | null = null;
  private readonly hits: THREE.Intersection[] = [];
  private readonly local = new THREE.Vector3();

  register(object: THREE.Object3D, target: PickTarget): void {
    this.targets.set(object, target);
    this.objects = null;
  }

  /** Registers each instance of the mesh as its own target, in instance order. */
  registerInstances(mesh: THREE.InstancedMesh, targets: readonly PickTarget[]): void {
    this.targets.set(mesh, targets);
    this.objects = null;
  }

  unregister(object: THREE.Object3D): void {
    this.targets.delete(object);
    this.objects = null;
  }

  /** The object under a canvas point given in CSS pixels from its top left; null for open sky. */
  pick(at: { x: number; y: number }): PickResult | null {
    this.aim(at);
    this.objects ??= [...this.targets.keys()];
    this.raycaster.intersectObjects(this.objects, true, this.hits);
    const hit = this.hits[0];
    const target = hit && this.targetOf(hit.object, hit.instanceId);
    const result = target ? { ...target, surface: this.surfaceOf(hit.point) } : null;
    this.hits.length = 0;
    return result;
  }

  /**
   * Where the ray under a canvas point first meets a sphere of the radius around the planet
   * centre, as a surface point of the planet; null when it passes by. With orNearest, a ray
   * that passes by gives the direction in which it comes nearest instead.
   */
  sphereAt(
    at: { x: number; y: number },
    radius: number,
    { orNearest = false }: { orNearest?: boolean } = {},
  ): SurfacePoint | null {
    this.aim(at);
    const { ray } = this.raycaster;
    const sphere = new THREE.Sphere(new THREE.Vector3(), radius);
    const point = ray.intersectSphere(sphere, new THREE.Vector3());
    if (point) {
      return this.surfaceOf(point);
    }
    return orNearest
      ? this.surfaceOf(ray.closestPointToPoint(sphere.center, new THREE.Vector3()))
      : null;
  }

  /** Points the ray from the camera through a canvas point. */
  private aim({ x, y }: { x: number; y: number }): void {
    const { scene, camera, width, height } = this.sceneService;
    // The renderer updates these while drawing, but a tap may come before the next frame.
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    this.pointer.set((x / width) * 2 - 1, 1 - (y / height) * 2);
    this.raycaster.setFromCamera(this.pointer, camera);
  }

  /** A point in the world, as the surface point of the planet in its direction. */
  private surfaceOf(point: THREE.Vector3): SurfacePoint {
    return fromVector(this.sceneService.planetGroup.worldToLocal(this.local.copy(point)));
  }

  /** The target of the object (or of the instance hit), or of its nearest registered ancestor. */
  private targetOf(object: THREE.Object3D, instanceId?: number): PickTarget | undefined {
    for (let current: THREE.Object3D | null = object; current; current = current.parent) {
      const target = this.targets.get(current);
      if (target && 'kind' in target) {
        return target;
      }
      if (target) {
        return instanceId === undefined ? undefined : target[instanceId];
      }
    }
    return undefined;
  }
}
