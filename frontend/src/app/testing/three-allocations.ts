import * as THREE from 'three';

/**
 * The three.js math classes a frame could make, and the first property each constructor gives
 * the new object (Vector3 sets this.x first, Matrix4 this.elements, Quaternion this.isQuaternion).
 */
const COUNTED: [string, { prototype: object }, string][] = [
  ['Vector2', THREE.Vector2, 'x'],
  ['Vector3', THREE.Vector3, 'x'],
  ['Vector4', THREE.Vector4, 'x'],
  ['Quaternion', THREE.Quaternion, 'isQuaternion'],
  ['Euler', THREE.Euler, 'isEuler'],
  ['Matrix3', THREE.Matrix3, 'elements'],
  ['Matrix4', THREE.Matrix4, 'elements'],
  ['Color', THREE.Color, 'isColor'],
  ['Sphere', THREE.Sphere, 'isSphere'],
  ['Box3', THREE.Box3, 'isBox3'],
];

/** Counts of the three.js math objects made, by class. */
export type ThreeAllocations = Record<string, number>;

/** No three.js math objects made at all. */
export const NO_ALLOCATIONS: ThreeAllocations = Object.fromEntries(
  COUNTED.map(([name]) => [name, 0]),
);

/**
 * Counts the three.js math objects made from now until stop(), by class. A setter on each
 * class's prototype stands in for the first property its constructor sets: a new object does
 * not have that property yet, so the constructor goes through the setter, which counts it and
 * gives the object the property as its own. Objects made before already have theirs, so using
 * them is not counted. stop() takes the setters away again.
 */
export function countThreeAllocations(): { counts: ThreeAllocations; stop(): void } {
  const counts: ThreeAllocations = { ...NO_ALLOCATIONS };
  for (const [name, type, property] of COUNTED) {
    Object.defineProperty(type.prototype, property, {
      configurable: true,
      get: () => undefined,
      set(this: object, value: unknown) {
        counts[name]++;
        Object.defineProperty(this, property, {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      },
    });
  }
  const stop = () => {
    for (const [, type, property] of COUNTED) {
      delete (type.prototype as Record<string, unknown>)[property];
    }
  };
  return { counts, stop };
}
