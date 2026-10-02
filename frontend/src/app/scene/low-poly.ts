import * as THREE from 'three';
import { STEP_ARC, SurfacePoint, toVector } from '../core/helpers/surface-coords';

/** Where a part sits in its model: offset, turn (radians, about y last) and size. */
export interface PartPlacement {
  at?: [number, number, number];
  turn?: [number, number, number];
  size?: number | [number, number, number];
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * One coloured primitive of a model, moved into place. The result is not indexed and carries
 * a colour per vertex, so parts merge into one geometry and every face shades flat.
 */
export function part(
  geometry: THREE.BufferGeometry,
  colour: THREE.ColorRepresentation,
  { at = [0, 0, 0], turn = [0, 0, 0], size = 1 }: PartPlacement = {},
): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) {
    geometry.dispose();
  }
  const scale = typeof size === 'number' ? [size, size, size] : size;
  flat.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...turn, 'YXZ')),
      new THREE.Vector3(...scale),
    ),
  );
  const count = flat.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  const rgb = new THREE.Color(colour);
  for (let vertex = 0; vertex < count; vertex++) {
    rgb.toArray(colours, vertex * 3);
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return flat;
}

/**
 * A long part, such as a frond, standing on the base point and leaning out by tilt radians
 * towards the direction spin (radians about y). The geometry is centred, as three.js builds it.
 */
export function leaning(
  geometry: THREE.BufferGeometry,
  colour: THREE.ColorRepresentation,
  length: number,
  tilt: number,
  spin: number,
  base: [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  const half = length / 2;
  const at: [number, number, number] = [
    base[0] + half * Math.sin(tilt) * Math.sin(spin),
    base[1] + half * Math.cos(tilt),
    base[2] + half * Math.sin(tilt) * Math.cos(spin),
  ];
  return part(geometry, colour, { at, turn: [tilt, spin, 0] });
}

/** Merges parts made by part() into one geometry, and frees the parts. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arrays = parts.map((each) => each.getAttribute(name).array as Float32Array);
    const all = new Float32Array(arrays.reduce((sum, array) => sum + array.length, 0));
    let offset = 0;
    for (const array of arrays) {
      all.set(array, offset);
      offset += array.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(all, 3));
  }
  parts.forEach((each) => each.dispose());
  return merged;
}

/**
 * The transform that stands a model upright on a surface point of a planet with the given
 * radius, turned about its own up axis. Models are built in steps (one unit is one step
 * across), so they cover the footprint the placement rules give them on any planet size.
 */
export function standOn(
  point: SurfacePoint,
  radius: number,
  spin: number,
  target = new THREE.Matrix4(),
): THREE.Matrix4 {
  const { x, y, z } = toVector(point, radius);
  const position = new THREE.Vector3(x, y, z);
  const upright = new THREE.Quaternion().setFromUnitVectors(UP, position.clone().normalize());
  upright.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
  const scale = radius * STEP_ARC;
  return target.compose(position, upright, new THREE.Vector3(scale, scale, scale));
}

/** A repeatable turn for an id, so neighbours of one kind do not all face the same way. */
export function spinOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return ((hash >>> 0) % 360) * THREE.MathUtils.DEG2RAD;
}
