import * as THREE from 'three';
import { sparkleModel } from './garden-models';
import { PickingService } from './picking.service';
import { SurfaceItem, poseOf } from './surface-item-layer';

/** A plant to sparkle over, drawn as the item, and how tall it is in steps. */
export interface SparklingPlant extends SurfaceItem {
  height: number;
}

export const SPARKLE_COLOUR = '#fff3a6';

/** Where each of a plant's sparkles sits, in steps from the top of the plant, and its size. */
const AROUND_TOP: [number, number, number, number][] = [
  [0.22, 0.05, 0.05, 1],
  [-0.18, 0.18, 0.1, 0.8],
  [0.04, 0.3, -0.16, 0.65],
];

/**
 * The little stars over blooms whose seeds are ready (GRD-08 AC1): a few around the top of
 * each, unlit so they shine on the night side too. A tap on one picks its plant. They stand
 * still until twinkle() moves them; each redraw starts them still at full size.
 */
export class Sparkles {
  private readonly geometry = sparkleModel();
  private readonly material = new THREE.MeshBasicMaterial({ color: SPARKLE_COLOUR });
  private current: THREE.InstancedMesh | null = null;
  private places: { at: THREE.Matrix4; size: number }[] = [];
  private drawn: string | null = null;

  constructor(
    private readonly group: THREE.Group,
    private readonly picking: PickingService,
  ) {}

  /** The mesh with one instance per sparkle; null while nothing sparkles. */
  get mesh(): THREE.InstancedMesh | null {
    return this.current;
  }

  /** Sparkles over exactly these plants on a planet of the radius; false when already drawn. */
  draw(plants: SparklingPlant[], radius: number): boolean {
    const drawing = JSON.stringify([radius, plants]);
    if (drawing === this.drawn) {
      return false;
    }
    this.drawn = drawing;
    this.clear();
    if (plants.length === 0) {
      return true;
    }
    this.places = plants.flatMap((plant) =>
      AROUND_TOP.map(([x, y, z, size]) => ({
        at: poseOf(plant, radius).multiply(
          new THREE.Matrix4().makeTranslation(x, plant.height + y, z),
        ),
        size,
      })),
    );
    this.current = new THREE.InstancedMesh(this.geometry, this.material, this.places.length);
    this.current.name = 'sparkles';
    this.twinkle(null);
    this.current.computeBoundingSphere();
    this.group.add(this.current);
    this.picking.registerInstances(
      this.current,
      plants.flatMap(({ id }) => AROUND_TOP.map(() => ({ kind: 'plant' as const, id }))),
    );
    return true;
  }

  /** Sizes and turns every sparkle for a time in seconds; null holds them still at full size. */
  twinkle(seconds: number | null): void {
    const mesh = this.current;
    if (!mesh) {
      return;
    }
    const matrix = new THREE.Matrix4();
    this.places.forEach(({ at, size }, i) => {
      const phase = seconds === null ? null : seconds * 2.4 + i * 1.9;
      const scale = phase === null ? size : size * (0.45 + 0.55 * Math.abs(Math.sin(phase)));
      matrix.makeRotationY(phase ?? 0).scale(new THREE.Vector3(scale, scale, scale));
      mesh.setMatrixAt(i, matrix.premultiply(at));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  private clear(): void {
    if (this.current) {
      this.group.remove(this.current);
      this.picking.unregister(this.current);
      this.current.dispose();
    }
    this.current = null;
    this.places = [];
  }
}
