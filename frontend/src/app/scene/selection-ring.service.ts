import { Injectable, effect, inject, untracked } from '@angular/core';
import * as THREE from 'three';
import { PLANT_FOOTPRINT_STEPS } from '../core/helpers/placement-rules';
import { SurfacePoint } from '../core/helpers/surface-coords';
import { CatalogueService } from '../core/services/catalogue.service';
import { CardTarget } from '../core/services/placement.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { CreatureMeshService } from './creature-mesh.service';
import { standOn } from './low-poly';
import { planetRadius } from './planet-mesh.service';
import { SceneService } from './scene.service';

/** A plant, decoration or creature to ring. */
export type RingTarget = Pick<CardTarget, 'kind' | 'id'>;

/**
 * A darker shade of the focus colour: at least 3:1 against every colour of the ground (grass,
 * sand and water), where the focus colour itself is too close to the darkest grass.
 */
export const RING_COLOUR = '#073b73';

/** How far the marker floats over the spot, in steps, clear of a bloom or a hovering flyer. */
const MARKER_HEIGHT = 2.4;
/** The ring lies just above the faceted ground, so no facet pokes through it. */
const RING_LIFT = 0.05;

/**
 * The ring around the plant, decoration or creature the keyboard has picked (SET-05 AC2), in
 * dark blue with a white edge that shows it on the shaded side too, and an arrow over it that
 * shows from afar. It stands on the planet, follows a creature as it wanders, and goes when
 * the target does. It is not pickable, so taps go through it. It never pulses or spins, so it
 * is as steady with reduced motion (SET-03) as without.
 */
@Injectable()
export class SelectionRingService {
  /** The ring and its arrow, in the planet group. */
  readonly ring = new THREE.Group();
  private readonly scene = inject(SceneService);
  private readonly store = inject(PlanetStore);
  private readonly catalogue = inject(CatalogueService);
  private readonly creatures = inject(CreatureMeshService);
  /** The ring itself, sized to the target's footprint; the arrow keeps its size. */
  private readonly band = new THREE.Group();
  private target: RingTarget | null = null;
  /** Where and how big the ring was last drawn; null while hidden. */
  private drawn: string | null = null;
  /** The ringed creature's point at the last update; a wandering creature gets a new one. */
  private followed: SurfacePoint | undefined;
  private readonly stance = new THREE.Matrix4();

  constructor() {
    const accent = new THREE.MeshBasicMaterial({ color: RING_COLOUR, side: THREE.DoubleSide });
    const edge = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const flat = (inner: number, outer: number, material: THREE.Material) =>
      new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 32).rotateX(-Math.PI / 2).translate(0, RING_LIFT, 0),
        material,
      );
    this.band.add(flat(0.6, 0.85, accent), flat(0.85, 0.95, edge));
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.6, 4).rotateX(Math.PI).translate(0, MARKER_HEIGHT, 0),
      accent,
    );
    this.ring.name = 'selection-ring';
    this.ring.add(this.band, arrow);
    this.ring.visible = false;
    this.scene.planetGroup.add(this.ring);

    effect(() => {
      this.store.snapshot();
      this.catalogue.catalogue();
      untracked(() => this.update());
    });
    // A creature wanders between snapshots. Checked every frame, so only a move costs anything.
    this.scene.onFrame(() => {
      if (this.followed !== this.creaturePoint()) {
        this.update();
      }
    });
  }

  /** What is ringed now; null for nothing. */
  get selected(): RingTarget | null {
    return this.target;
  }

  /** Rings the plant, decoration or creature; null takes the ring away. */
  select(target: RingTarget | null): void {
    this.target = target;
    this.update();
  }

  /** Stands the ring where its target is now, sized to it; hidden without one. */
  update(): void {
    this.followed = this.creaturePoint();
    const snapshot = this.store.snapshot();
    const spot = this.target && snapshot ? this.spotOf(this.target) : null;
    const radius = planetRadius(snapshot?.radiusLevel ?? 1);
    // Draws only when the ring moved, so a creature sitting still costs nothing.
    const drawn = spot && `${spot.point.lat} ${spot.point.lon} ${spot.steps} ${radius}`;
    if (drawn === this.drawn) {
      return;
    }
    this.drawn = drawn;
    this.ring.visible = spot !== null;
    if (spot) {
      standOn(spot.point, radius, 0, this.stance).decompose(
        this.ring.position,
        this.ring.quaternion,
        this.ring.scale,
      );
      this.band.scale.set(spot.steps, 1, spot.steps);
    }
    this.scene.requestRender();
  }

  /** Where the ringed creature is drawn now; undefined when no creature is ringed. */
  private creaturePoint(): SurfacePoint | undefined {
    const target = this.target;
    return target?.kind === 'creature' ? this.creatures.creature(target.id)?.point : undefined;
  }

  /** Where the target stands and how many steps across it is; null once it is gone. */
  private spotOf({ kind, id }: RingTarget): { point: SurfacePoint; steps: number } | null {
    const snapshot = this.store.snapshot()!;
    if (kind === 'creature') {
      const drawn = this.creatures.creature(id);
      const creature = snapshot.creatures.find((each) => each.id === id);
      return creature ? { point: drawn?.point ?? creature, steps: 1 } : null;
    }
    if (kind === 'plant') {
      const plant = snapshot.plants.find((each) => each.id === id);
      return plant ? { point: plant, steps: PLANT_FOOTPRINT_STEPS } : null;
    }
    const decoration = snapshot.decorations.find((each) => each.id === id);
    const steps = decoration
      ? (this.catalogue.decoration(decoration.type)?.footprintSteps ?? 1)
      : 1;
    return decoration ? { point: decoration, steps } : null;
  }
}
