import { Injectable, effect, inject, untracked } from '@angular/core';
import * as THREE from 'three';
import { PlacementSelection, PlacementService } from '../core/services/placement.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { decorationModel, plantModel } from './garden-models';
import { standOn } from './low-poly';
import { planetRadius } from './planet-mesh.service';
import { SceneService } from './scene.service';

/** Tints for a spot the item may go on, and one it may not; the HUD says which in words. */
export const GHOST_ALLOWED = new THREE.Color('#3fbf5f');
export const GHOST_REFUSED = new THREE.Color('#e04848');

/**
 * The see-through preview of the selected item at the preview point (GRD-01 AC2, AC3): the
 * item itself on a disc the size of its footprint, tinted for whether the spot is allowed.
 * It is not pickable, so taps go through it to the planet. Hidden without a selection.
 */
@Injectable()
export class PlacementGhostService {
  /** The ghost, in the planet group. */
  readonly ghost = new THREE.Group();
  private readonly discMaterial = ghostMaterial(0.3);
  private readonly modelMaterial = ghostMaterial(0.55);
  private readonly model = new THREE.Mesh(new THREE.BufferGeometry(), this.modelMaterial);
  private modelName = '';

  constructor() {
    const scene = inject(SceneService);
    const placement = inject(PlacementService);
    const store = inject(PlanetStore);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2).translate(0, 0.04, 0),
      this.discMaterial,
    );
    const footprint = new THREE.Group().add(disc);
    this.ghost.add(footprint, this.model);
    this.ghost.visible = false;
    scene.planetGroup.add(this.ghost);

    effect(() => {
      const selected = placement.selected();
      const point = placement.previewPoint();
      const reason = placement.preview();
      const steps = placement.footprintSteps();
      const radius = planetRadius(store.snapshot()?.radiusLevel ?? 1);
      untracked(() => {
        this.ghost.visible = selected !== null && point !== null;
        if (selected && point) {
          this.useModel(selected);
          standOn(point, radius, 0).decompose(
            this.ghost.position,
            this.ghost.quaternion,
            this.ghost.scale,
          );
          footprint.scale.set(steps, 1, steps);
          const tint = reason === 'ok' ? GHOST_ALLOWED : GHOST_REFUSED;
          this.discMaterial.color.copy(tint);
          this.modelMaterial.color.copy(tint);
        }
        scene.requestRender();
      });
    });
  }

  /** A seed shows as the sprout it becomes; a decoration as itself. */
  private useModel(selected: PlacementSelection): void {
    const seed = selected.mode === 'place' && selected.kind === 'seed';
    const name = `${seed ? 'seed' : 'decoration'}:${selected.itemType}`;
    if (name === this.modelName) {
      return;
    }
    this.modelName = name;
    this.model.geometry.dispose();
    this.model.geometry = seed
      ? plantModel(selected.itemType, 'sprout')
      : decorationModel(selected.itemType);
  }
}

function ghostMaterial(opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false });
}
