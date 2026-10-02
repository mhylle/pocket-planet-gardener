import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import type { MockInstance } from 'vitest';
import { SurfacePoint, toVector } from '../core/helpers/surface-coords';
import { PlanetSnapshotDto, PlantDto } from '../core/models/planet-snapshot';
import { PlanetStore } from '../core/services/planet-store.service';
import { MOSSY, plantAt } from '../testing/garden-fixtures';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { PlanetMeshService } from './planet-mesh.service';
import { DROOP_LEAN, DROOP_TINT, PlantMeshService } from './plant-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';

describe('PlantMeshService', () => {
  let scene: SceneService;
  let store: PlanetStore;
  let picking: PickingService;
  let plants: PlantMeshService;
  let onFrame: MockInstance<SceneService['onFrame']>;

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
    onFrame = vi.spyOn(scene, 'onFrame');
    plants = TestBed.inject(PlantMeshService);
  });

  afterEach(() => vi.unstubAllGlobals());

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

  /** Where an instance stands, which way is up for it, and its tint (white without one). */
  const instance = (mesh: THREE.InstancedMesh, i: number) => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const turn = new THREE.Quaternion();
    mesh.getMatrixAt(i, matrix);
    matrix.decompose(position, turn, new THREE.Vector3());
    const tint = new THREE.Color('#ffffff');
    if (mesh.instanceColor) {
      mesh.getColorAt(i, tint);
    }
    return { position, up: new THREE.Vector3(0, 1, 0).applyQuaternion(turn), tint };
  };

  /** Radians between an instance's up and the planet's up at its point. */
  const leanOf = (mesh: THREE.InstancedMesh, i: number) => {
    const { position, up } = instance(mesh, i);
    return up.angleTo(position.clone().normalize());
  };

  const sparkleMatrices = (mesh: THREE.InstancedMesh | null) => [
    ...(mesh?.instanceMatrix.array ?? []),
  ];

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

  it('leans a thirsty plant over in a duller colour, the others upright (GRD-04 AC3)', () => {
    show([front, { ...side, water: 0.05 }]);
    const [clovers] = plants.meshes;

    expect(leanOf(clovers, 0)).toBeLessThan(1e-6);
    expect(instance(clovers, 0).tint.getHexString()).toBe('ffffff');
    expect(leanOf(clovers, 1)).toBeCloseTo(DROOP_LEAN, 6);
    expect('#' + instance(clovers, 1).tint.getHexString()).toBe(DROOP_TINT);
    // Still standing on its own point, and still pickable.
    const { x, y, z } = toVector(side, 1);
    expect(instance(clovers, 1).position.distanceTo(new THREE.Vector3(x, y, z))).toBeLessThan(1e-6);
    expect(pickAt(side)).toMatchObject({ kind: 'plant', id: side.id });
  });

  it('sparkles over a bloom with seeds ready, pickable as the plant (GRD-08 AC1)', () => {
    const ready = { ...back, harvestReady: true };
    show([front, ready, plantAt('tulip-1', 10, 10, { type: 'tulip', stage: 'bloom' })]);

    const sparkles = plants.sparkleMesh!;
    expect(sparkles.parent).toBe(scene.planetGroup);
    expect(sparkles.count).toBe(3);
    const { x, y, z } = toVector(ready, 1);
    const ground = new THREE.Vector3(x, y, z);
    for (let i = 0; i < sparkles.count; i++) {
      const { position } = instance(sparkles, i);
      // Above the sunflower, which stands about 1.4 steps of 0.087 tall.
      expect(position.length()).toBeGreaterThan(1.1);
      expect(position.distanceTo(ground)).toBeLessThan(0.2);
    }
    expect(pickAt(ready)).toMatchObject({ kind: 'plant', id: ready.id });
  });

  it('never sparkles over a plant that is not a bloom with seeds ready', () => {
    show([
      plantAt('young-1', 0, 0, { stage: 'young', harvestReady: true }),
      plantAt('bloom-1', 20, 20, { stage: 'bloom', harvestReady: false }),
    ]);

    expect(plants.sparkleMesh).toBeNull();
  });

  it('updates droop and sparkles as the snapshot changes', () => {
    const thirstyBloom = { ...back, water: 0, harvestReady: true };
    show([thirstyBloom]);
    expect(leanOf(plants.meshes[0], 0)).toBeCloseTo(DROOP_LEAN, 6);
    expect(plants.sparkleMesh?.count).toBe(3);
    const render = vi.spyOn(scene, 'requestRender');

    // Watered, then harvested: upright again and no more sparkles.
    show([{ ...thirstyBloom, water: 0.6 }]);
    expect(render).toHaveBeenCalledTimes(1);
    expect(leanOf(plants.meshes[0], 0)).toBeLessThan(1e-6);
    expect(plants.meshes[0].instanceColor).toBeNull();
    expect(plants.sparkleMesh?.count).toBe(3);

    show([{ ...thirstyBloom, water: 0.6, harvestReady: false }]);
    expect(render).toHaveBeenCalledTimes(2);
    expect(plants.sparkleMesh).toBeNull();
    expect(scene.planetGroup.getObjectByName('sparkles')).toBeUndefined();
  });

  it('twinkles the sparkles frame by frame, drawing each frame while they show', () => {
    const [step] = onFrame.mock.calls[0];
    show([{ ...back, harvestReady: true }]);
    const still = sparkleMatrices(plants.sparkleMesh);
    const render = vi.spyOn(scene, 'requestRender');

    step(0.4);

    expect(sparkleMatrices(plants.sparkleMesh)).not.toEqual(still);
    expect(render).toHaveBeenCalled();

    // Nothing sparkles: the frames rest.
    show([back]);
    render.mockClear();
    step(0.4);
    expect(render).not.toHaveBeenCalled();
  });

  it('holds the sparkles still when the device asks for reduced motion (SET-03)', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }));
    const calm = TestBed.runInInjectionContext(() => new PlantMeshService());
    const [step] = onFrame.mock.calls[1];
    show([{ ...back, harvestReady: true }]);
    const still = sparkleMatrices(calm.sparkleMesh);
    const render = vi.spyOn(scene, 'requestRender');

    step(0.4);

    expect(still.length).toBeGreaterThan(0);
    expect(sparkleMatrices(calm.sparkleMesh)).toEqual(still);
    expect(render).not.toHaveBeenCalled();
  });
});
