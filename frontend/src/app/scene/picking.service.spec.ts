import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { fromVector, toVector } from '../core/helpers/surface-coords';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { PlanetMeshService } from './planet-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';

describe('PickingService', () => {
  let picking: PickingService;
  let scene: SceneService;
  const centre = { x: 400, y: 300 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SceneService,
        PickingService,
        PlanetMeshService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    picking = TestBed.inject(PickingService);
    TestBed.inject(PlanetMeshService);
  });

  it('finds the planet on a ray through its centre, at a surface point that round-trips', () => {
    const turns = [
      new THREE.Euler(0, 0, 0),
      new THREE.Euler(0.4, -2.1, 0.3),
      new THREE.Euler(-1.5, 0.7, 2.9),
      new THREE.Euler(Math.PI / 2, 0, 0),
    ];
    for (const turn of turns) {
      scene.planetGroup.quaternion.setFromEuler(turn);

      const hit = picking.pick(centre)!;

      expect(hit.kind).toBe('planet');
      expect(hit.id).toBeUndefined();
      // The point found is the one the turned planet shows the camera...
      const { x, y, z } = toVector(hit.surface!, 1);
      const shown = new THREE.Vector3(x, y, z).applyQuaternion(scene.planetGroup.quaternion);
      expect(shown.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-6);
      // ...and survives the trip through surface-coords.
      const again = fromVector(toVector(hit.surface!, 1));
      expect(again.lat).toBeCloseTo(hit.surface!.lat, 6);
      expect(Math.cos(THREE.MathUtils.degToRad(again.lon - hit.surface!.lon))).toBeCloseTo(1, 9);
    }
  });

  it('finds nothing in the open sky', () => {
    expect(picking.pick({ x: 2, y: 2 })).toBeNull();
  });

  it('finds the nearest registered object, through its children', () => {
    const plant = new THREE.Group();
    const { x, y, z } = toVector({ lat: 0, lon: 0 }, 1.05);
    plant.position.set(x, y, z);
    plant.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()));
    scene.planetGroup.add(plant);

    expect(picking.pick(centre)?.kind).toBe('planet');

    picking.register(plant, { kind: 'plant', id: 'clover-1' });
    expect(picking.pick(centre)).toEqual({
      kind: 'plant',
      id: 'clover-1',
      surface: { lat: expect.closeTo(0, 6), lon: expect.closeTo(0, 6) },
    });

    picking.unregister(plant);
    expect(picking.pick(centre)?.kind).toBe('planet');
  });

  it('finds the instance hit when each instance stands for its own target', () => {
    const plants = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial(),
      2,
    );
    const away = toVector({ lat: 0, lon: 90 }, 1.05);
    const front = toVector({ lat: 0, lon: 0 }, 1.05);
    plants.setMatrixAt(0, new THREE.Matrix4().makeTranslation(away.x, away.y, away.z));
    plants.setMatrixAt(1, new THREE.Matrix4().makeTranslation(front.x, front.y, front.z));
    scene.planetGroup.add(plants);

    picking.registerInstances(plants, [
      { kind: 'plant', id: 'fern-1' },
      { kind: 'plant', id: 'clover-1' },
    ]);

    expect(picking.pick(centre)).toMatchObject({ kind: 'plant', id: 'clover-1' });
  });
});
