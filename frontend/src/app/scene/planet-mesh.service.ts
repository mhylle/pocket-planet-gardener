import { Injectable, inject } from '@angular/core';
import * as THREE from 'three';
import { PickingService } from './picking.service';
import { SceneService } from './scene.service';

/** How much wider the planet gets with each radius level. */
const GROWTH_PER_LEVEL = 0.15;
/** The icosahedron's subdivision: 320 faces, enough for patches of colour, few enough to look low-poly. */
const DETAIL = 3;

const GRASS = ['#7cc36b', '#8fd078', '#6ab35f', '#9bd47f'];
const SAND = '#ead59c';
const WATER = '#86c9e8';
/** Faces where the terrain field rises above this are water, below the other are sand. */
const WATER_ABOVE = 0.45;
const SAND_BELOW = -0.5;

/** The planet radius in scene units: 1 at radius level 1, growing by 0.15 per level. */
export function planetRadius(radiusLevel: number): number {
  return 1 + GROWTH_PER_LEVEL * (radiusLevel - 1);
}

/**
 * The planet itself (D-8): a flat-shaded icosahedron in the planet group, mostly grassy with a
 * few patches of sand and water. It is built at radius 1 and scaled to the planet's radius.
 */
@Injectable()
export class PlanetMeshService {
  private readonly scene = inject(SceneService);
  private currentRadius = 1;

  readonly mesh = new THREE.Mesh(
    planetGeometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );

  constructor() {
    this.scene.planetGroup.add(this.mesh);
    inject(PickingService).register(this.mesh, { kind: 'planet' });
  }

  /** The planet radius in scene units. */
  get radius(): number {
    return this.currentRadius;
  }

  setRadiusLevel(radiusLevel: number): void {
    this.currentRadius = planetRadius(radiusLevel);
    this.mesh.scale.setScalar(this.currentRadius);
    this.scene.requestRender();
  }
}

/** A unit icosahedron with one colour per face. */
function planetGeometry(): THREE.BufferGeometry {
  // Not indexed: every face has its own three vertices, so each face can have its own colour.
  const geometry = new THREE.IcosahedronGeometry(1, DETAIL);
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const centre = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const colour = new THREE.Color();
  for (let face = 0; face < position.count; face += 3) {
    centre.set(0, 0, 0);
    for (let i = 0; i < 3; i++) {
      centre.add(corner.fromBufferAttribute(position, face + i));
    }
    colour.set(faceColour(centre.normalize()));
    for (let i = 0; i < 3; i++) {
      colour.toArray(colours, (face + i) * 3);
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function faceColour(direction: THREE.Vector3): string {
  const height = terrain(direction);
  if (height > WATER_ABOVE) {
    return WATER;
  }
  if (height < SAND_BELOW) {
    return SAND;
  }
  return GRASS[Math.floor(hash(direction) * GRASS.length)];
}

/** A smooth, gently bumpy field over the sphere, roughly -1 to 1. */
function terrain({ x, y, z }: THREE.Vector3): number {
  const swell = Math.sin(3.1 * x + 1.3) * Math.sin(2.7 * y + 0.5) * Math.sin(3.4 * z + 2.2);
  const ripple = 0.5 * Math.sin(5.3 * x - 4.1 * z + 0.7);
  return (swell + ripple) / 1.5;
}

/** A repeatable number from 0 to just under 1 for a direction, so neighbouring faces differ. */
function hash({ x, y, z }: THREE.Vector3): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return value - Math.floor(value);
}
