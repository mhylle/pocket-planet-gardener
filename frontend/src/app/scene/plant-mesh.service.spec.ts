import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { SurfacePoint, toVector } from '../core/helpers/surface-coords';
import { PlanetSnapshotDto, PlantDto } from '../core/models/planet-snapshot';
import { PlanetStore } from '../core/services/planet-store.service';
import { MOSSY, plantAt } from '../testing/garden-fixtures';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { PlanetMeshService } from './planet-mesh.service';
import { PlantMeshService } from './plant-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';

describe('PlantMeshService', () => {
  let scene: SceneService;
  let store: PlanetStore;
  let picking: PickingService;
  let plants: PlantMeshService;

  const front = plantAt('clover-1', 0, 0);
  const side = plantAt('clover-2', 40, 60);
  const back = plantAt('sunflower-1', -30, -100, { type: 'sunflower', stage: 'bloom' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SceneService,
        PickingService,
        PlanetMeshService,
        PlantMeshService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    store = TestBed.inject(PlanetStore);
    picking = TestBed.inject(PickingService);
    TestBed.inject(PlanetMeshService);
    plants = TestBed.inject(PlantMeshService);
  });

  const show = (list: PlantDto[], changes: Partial<PlanetSnapshotDto> = {}) => {
    store.setSnapshot({ ...MOSSY, ...changes, plants: list });
    TestBed.tick();
  };

  /** Turns the planet so the point faces the camera, then picks the middle of the view. */
  const pickAt = (point: SurfacePoint) => {
    const { x, y, z } = toVector(point, 1);
    scene.planetGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(0, 0, 1),
    );
    return picking.pick({ x: 400, y: 300 });
  };

  const drawn = () =>
    plants.meshes.map((mesh) => [mesh.name, mesh.count, mesh.parent === scene.planetGroup]);

  it('draws nothing before a planet is loaded', () => {
    TestBed.tick();

    expect(plants.meshes).toEqual([]);
  });

  it('draws one instance per plant, grouped by type and stage, each pickable as its plant', () => {
    show([front, side, back]);

    expect(drawn()).toEqual([
      ['clover/seed', 2, true],
      ['sunflower/bloom', 1, true],
    ]);
    for (const plant of [front, side, back]) {
      expect(pickAt(plant)).toMatchObject({ kind: 'plant', id: plant.id });
    }
  });

  it('stands each plant upright on its surface point, also on a grown planet', () => {
    show([side], { radiusLevel: 3 });
    const position = new THREE.Vector3();
    const turn = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    plants.meshes[0].getMatrixAt(0, matrix);
    matrix.decompose(position, turn, new THREE.Vector3());

    const { x, y, z } = toVector(side, 1.3);
    expect(position.distanceTo(new THREE.Vector3(x, y, z))).toBeLessThan(1e-6);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(turn);
    expect(up.distanceTo(position.clone().normalize())).toBeLessThan(1e-6);
  });

  it('redraws when the plants change, and only then', () => {
    show([front, side, back]);
    const render = vi.spyOn(scene, 'requestRender');
    const before = plants.meshes;

    // A heartbeat with the same plants.
    show([front, side, back], { version: 2 });
    expect(render).not.toHaveBeenCalled();
    expect(plants.meshes).toBe(before);

    // One dug up, one grown.
    show([front, { ...back, stage: 'young' }]);
    expect(render).toHaveBeenCalled();
    expect(drawn()).toEqual([
      ['clover/seed', 1, true],
      ['sunflower/young', 1, true],
    ]);
    expect(before.every((mesh) => mesh.parent === null)).toBe(true);
    expect(pickAt(side)?.kind).toBe('planet');
    expect(pickAt(back)).toMatchObject({ kind: 'plant', id: back.id });
  });
});
