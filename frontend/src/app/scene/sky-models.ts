import * as THREE from 'three';
import { merge, part } from './low-poly';

/*
 * The low-poly cloud and sun (D-8), built from three.js primitives. Units are steps on the
 * planet surface, like the garden models; the sky scales them by the planet radius.
 */

const gem = (radius: number) => new THREE.IcosahedronGeometry(radius, 0);

const UP = new THREE.Vector3(0, 1, 0);

/** A cloud: a few faceted puffs, about four steps across, flat underneath. */
export function cloudModel(): THREE.BufferGeometry {
  return merge([
    part(gem(1), '#ffffff', { size: [1.3, 0.85, 1.1] }),
    part(gem(1), '#f4f7fb', { at: [1.15, -0.2, 0.15], size: 0.8 }),
    part(gem(1), '#f4f7fb', { at: [-1.1, -0.25, -0.1], size: 0.75 }),
    part(gem(1), '#ffffff', { at: [0.25, 0.55, -0.25], size: 0.7 }),
    part(gem(1), '#e9eef5', { at: [-0.3, -0.35, 0.45], size: 0.65 }),
  ]);
}

/** The sun: a glowing ball with a short spike out of every corner of an icosahedron. */
export function sunModel(): THREE.BufferGeometry {
  const icosahedron = gem(1);
  const corners = icosahedron.getAttribute('position');
  const directions: THREE.Vector3[] = [];
  for (let i = 0; i < corners.count; i++) {
    const direction = new THREE.Vector3().fromBufferAttribute(corners, i).normalize();
    if (!directions.some((each) => each.distanceTo(direction) < 1e-6)) {
      directions.push(direction);
    }
  }
  icosahedron.dispose();
  const spikes = directions.map((direction) => {
    const turn = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(UP, direction),
      'YXZ',
    );
    return part(new THREE.ConeGeometry(0.35, 0.9, 4), '#ffb938', {
      at: direction.multiplyScalar(1.55).toArray(),
      turn: [turn.x, turn.y, turn.z],
    });
  });
  return merge([part(new THREE.IcosahedronGeometry(1.2, 1), '#ffd95a'), ...spikes]);
}
