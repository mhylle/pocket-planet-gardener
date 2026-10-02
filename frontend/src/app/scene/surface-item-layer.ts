import * as THREE from 'three';
import { SurfacePoint } from '../core/helpers/surface-coords';
import { standOn, spinOf } from './low-poly';
import { PickKind, PickingService } from './picking.service';

/** One thing to draw on the surface, and the model it is drawn with. */
export interface SurfaceItem {
  id: string;
  model: string;
  point: SurfacePoint;
}

/**
 * Many small things on the planet surface, such as the plants: one InstancedMesh per model,
 * with each instance pickable as its own item. Redrawing replaces the meshes; the model
 * geometries are built once and kept.
 */
export class SurfaceItemLayer {
  private readonly material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private current: THREE.InstancedMesh[] = [];
  private drawn: string | null = null;

  constructor(
    private readonly kind: PickKind,
    private readonly group: THREE.Group,
    private readonly picking: PickingService,
    private readonly buildModel: (model: string) => THREE.BufferGeometry,
  ) {}

  /** The meshes drawn now, one per model in use. */
  get meshes(): readonly THREE.InstancedMesh[] {
    return this.current;
  }

  /** Draws exactly these items on a planet of the radius; false when that is already drawn. */
  draw(items: SurfaceItem[], radius: number): boolean {
    const drawing = JSON.stringify([radius, items]);
    if (drawing === this.drawn) {
      return false;
    }
    this.drawn = drawing;
    this.clear();
    const byModel = new Map<string, SurfaceItem[]>();
    for (const item of items) {
      byModel.set(item.model, [...(byModel.get(item.model) ?? []), item]);
    }
    for (const [model, group] of byModel) {
      const mesh = new THREE.InstancedMesh(this.geometry(model), this.material, group.length);
      mesh.name = model;
      group.forEach((item, i) => mesh.setMatrixAt(i, standOn(item.point, radius, spinOf(item.id))));
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.picking.registerInstances(
        mesh,
        group.map(({ id }) => ({ kind: this.kind, id })),
      );
      this.current.push(mesh);
    }
    return true;
  }

  private clear(): void {
    for (const mesh of this.current) {
      this.group.remove(mesh);
      this.picking.unregister(mesh);
      // Frees the instance buffers; the geometry and material are kept for the next drawing.
      mesh.dispose();
    }
    this.current = [];
  }

  private geometry(model: string): THREE.BufferGeometry {
    let geometry = this.geometries.get(model);
    if (!geometry) {
      geometry = this.buildModel(model);
      this.geometries.set(model, geometry);
    }
    return geometry;
  }
}
