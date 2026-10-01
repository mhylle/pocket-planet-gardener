import * as THREE from 'three';
import { NullSceneRenderer } from './null-scene-renderer';

describe('three.js in the test environment', () => {
  it('can be imported and used', () => {
    expect(new THREE.Vector3(3, 4, 0).length()).toBe(5);
  });
});

describe('NullSceneRenderer', () => {
  it('accepts every call without a WebGL context', () => {
    const renderer = new NullSceneRenderer();

    expect(() => {
      renderer.attach(document.createElement('canvas'));
      renderer.resize(800, 600);
      renderer.render();
      renderer.dispose();
    }).not.toThrow();
  });
});
