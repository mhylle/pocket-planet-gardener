import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as THREE from 'three';
import type { MockInstance } from 'vitest';
import { PlanetSnapshotDto } from '../core/models/planet-snapshot';
import { CatalogueService } from '../core/services/catalogue.service';
import { PlacementService } from '../core/services/placement.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { FAKE_MOTION_PROVIDERS } from '../testing/fake-motion';
import { CATALOGUE, MOSSY, creatureAt } from '../testing/garden-fixtures';
import { DECORATION_TYPES, PLANT_STAGES, PLANT_TYPES, fullPlanet } from '../testing/full-planet';
import { seededRandom } from '../testing/seeded-random';
import { NO_ALLOCATIONS, countThreeAllocations } from '../testing/three-allocations';
import { CameraControlsService } from './camera-controls.service';
import { CreatureMeshService } from './creature-mesh.service';
import { DecorationMeshService } from './decoration-mesh.service';
import { GardenInputService } from './garden-input.service';
import { InputService } from './input.service';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { PlacementGhostService } from './placement-ghost.service';
import { PlanetMeshService } from './planet-mesh.service';
import { PlantMeshService } from './plant-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SCENE_PROVIDERS } from './scene.providers';
import { SceneService } from './scene.service';
import { SelectionRingService } from './selection-ring.service';
import { SkyService } from './sky.service';

/** Every plant type at every stage: the models a full planet draws its plants with. */
const PLANT_MODELS = PLANT_TYPES.length * PLANT_STAGES.length;

describe('the 3D view of a full planet (NFR-02)', () => {
  let renderer: NullSceneRenderer;
  let scene: SceneService;
  let store: PlanetStore;
  let creatures: CreatureMeshService;

  beforeEach(() => {
    vi.useFakeTimers();
    renderer = new NullSceneRenderer();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        PlacementService,
        FAKE_MOTION_PROVIDERS,
        { provide: SCENE_RENDERER, useValue: renderer },
      ],
    });
    store = TestBed.inject(PlanetStore);
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    creatures = TestBed.inject(CreatureMeshService);
    creatures.random = seededRandom(7);
    // Everything the planet page starts, as it starts it.
    TestBed.inject(PlanetMeshService);
    TestBed.inject(PlantMeshService);
    TestBed.inject(DecorationMeshService);
    TestBed.inject(SkyService);
    TestBed.inject(SelectionRingService);
    TestBed.inject(PlacementGhostService);
    TestBed.inject(GardenInputService);
    TestBed.inject(CameraControlsService);
  });

  afterEach(() => vi.useRealTimers());

  const show = (snapshot: PlanetSnapshotDto) => {
    store.setSnapshot(snapshot);
    TestBed.tick();
  };

  /** Everything in the scene, drawn or not. */
  const objects = (root: THREE.Object3D = scene.scene) => {
    let count = 0;
    root.traverse(() => count++);
    return count;
  };

  /** The things the renderer draws, one draw call each. */
  const drawCalls = () => {
    let count = 0;
    scene.scene.traverseVisible((object) => {
      const drawn =
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Sprite ||
        object instanceof THREE.Points;
      count += drawn ? 1 : 0;
    });
    return count;
  };

  describe('scene objects', () => {
    it('grow with the plant models and the creatures, not with the plants', () => {
      show({ ...MOSSY, id: 'empty' });
      const empty = drawCalls();

      show(fullPlanet());
      const plants = TestBed.inject(PlantMeshService);
      expect(plants.meshes).toHaveLength(PLANT_MODELS);
      expect(plants.meshes.every((mesh) => mesh instanceof THREE.InstancedMesh)).toBe(true);
      expect(plants.meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(60);
      expect(TestBed.inject(DecorationMeshService).meshes).toHaveLength(DECORATION_TYPES.length);
      // Each creature is a group with its body, and its "z" while it naps.
      const drawn = creatures.creatures;
      expect(drawn).toHaveLength(8);
      for (const creature of drawn) {
        expect(objects(creature.group)).toBe(creature.asleep ? 3 : 2);
      }
      const napping = drawn.filter(({ asleep }) => asleep).length;
      // One mesh per plant model, one for all the sparkles, one per decoration type, and the
      // three clouds, on top of the empty planet.
      expect(drawCalls()).toBe(
        empty + PLANT_MODELS + 1 + DECORATION_TYPES.length + 3 + drawn.length + napping,
      );
      const full = { objects: objects(), drawCalls: drawCalls() };

      show(fullPlanet({ id: 'twice-the-plants', plants: 120 }));
      expect(plants.meshes).toHaveLength(PLANT_MODELS);
      expect({ objects: objects(), drawCalls: drawCalls() }).toEqual(full);

      // The same 60 plants with one model, none in bloom: one plant mesh and no sparkles.
      show(fullPlanet({ id: 'one-model', type: 'clover' }));
      expect(plants.meshes).toHaveLength(1);
      expect(drawCalls()).toBe(full.drawCalls - PLANT_MODELS);
    });
  });

  describe('frames', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      canvas = document.createElement('canvas');
      scene.attach(canvas);
      scene.resize(800, 600);
    });

    afterEach(() => scene.dispose());

    /** Runs n animation frames of about 16 ms, with the timers due in them. */
    const frames = (n: number) => vi.advanceTimersByTime(n * 16);

    it('counts the three.js math objects made, not those used, and leaves them working', () => {
      const old = new THREE.Vector3();
      const counter = countThreeAllocations();
      const vector = new THREE.Vector3(1, 2, 3).add(old);
      const quaternion = new THREE.Quaternion().setFromAxisAngle(vector.clone().normalize(), 1);
      const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
      old.set(4, 5, 6);
      counter.stop();

      expect(counter.counts).toEqual({
        ...NO_ALLOCATIONS,
        Vector3: 2,
        Quaternion: 1,
        Matrix4: 1,
      });
      expect(vector.toArray()).toEqual([1, 2, 3]);
      expect(quaternion.isQuaternion).toBe(true);
      expect(matrix.elements).toHaveLength(16);
      expect(new THREE.Vector3(7, 8, 9).toArray()).toEqual([7, 8, 9]);
    });

    it('make no three.js math objects while everything moves at once, after warming up', () => {
      const sky = TestBed.inject(SkyService);
      const ring = TestBed.inject(SelectionRingService);
      const controls = TestBed.inject(CameraControlsService);
      const sparkles = () => TestBed.inject(PlantMeshService).sparkleMesh!.instanceMatrix.version;
      const rain = () =>
        (sky.rainOf('cloud-1')!.geometry.getAttribute('position') as THREE.BufferAttribute)
          .version;
      const planet = fullPlanet({ creatures: 7 });
      show(planet);
      // A newcomer drops in while another creature cheers.
      show({
        ...planet,
        version: 2,
        creatures: [...planet.creatures, creatureAt('newcomer', 0, 0, { species: 'bee' })],
      });
      creatures.cheer('creature-1');
      // Daylight on the first creature, which is ringed, and done sitting so it walks.
      const first = planet.creatures[0];
      sky.holdSun(first.lon);
      ring.select({ kind: 'creature', id: first.id });
      creatures.tick(6);
      sky.setRaining('cloud-1', true);
      sky.setRaining('cloud-2', true);
      // The planet turns on a held key while the zoom eases out.
      controls.key({ code: 'ArrowLeft', key: 'ArrowLeft', down: true });
      controls.wheel({ delta: 400 });
      frames(10);

      const before = {
        turn: scene.planetGroup.quaternion.clone(),
        distance: scene.camera.position.z,
        sparkles: sparkles(),
        rain: rain(),
        walker: creatures.creature(first.id)!.point,
        ring: ring.ring.position.clone(),
      };
      expect(creatures.creature('newcomer')!.arrival).not.toBeNull();
      expect(creatures.creature('creature-1')!.cheer).not.toBeNull();
      const render = vi.spyOn(renderer, 'render');
      let turned = 0;
      controls.turned.subscribe((angle) => (turned += angle));

      const counter = countThreeAllocations();
      frames(300);
      counter.stop();

      expect(counter.counts).toEqual(NO_ALLOCATIONS);
      // And all of it was moving, and drawn on every frame.
      expect(render.mock.calls.length).toBeGreaterThanOrEqual(295);
      expect(turned).toBeGreaterThan(3);
      expect(scene.planetGroup.quaternion.equals(before.turn)).toBe(false);
      expect(scene.camera.position.z).toBeGreaterThan(before.distance);
      expect(sparkles()).toBeGreaterThan(before.sparkles + 250);
      expect(rain()).toBeGreaterThan(before.rain + 250);
      expect(creatures.creature(first.id)!.point).not.toEqual(before.walker);
      expect(ring.ring.position.equals(before.ring)).toBe(false);
      expect(creatures.creature('newcomer')!.arrival).toBeNull();
      expect(creatures.creature('creature-1')!.cheer).toBeNull();
    });

    describe('picking under the mouse while placing a seed', () => {
      let placement: PlacementService;
      let pick: MockInstance<PickingService['pick']>;

      beforeEach(() => {
        show(fullPlanet());
        // Out from between the camera and the planet.
        TestBed.inject(SkyService).holdSun(180);
        placement = TestBed.inject(PlacementService);
        placement.select({ itemType: 'clover', kind: 'seed' });
        TestBed.tick();
        TestBed.inject(InputService).connect(canvas);
        canvas.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: 420,
            clientY: 300,
          }),
        );
        frames(10);
        pick = vi.spyOn(TestBed.inject(PickingService), 'pick');
      });

      afterEach(() => TestBed.inject(InputService).disconnect());

      it('picks nothing again, and makes nothing, while only the sparkles move', () => {
        const counter = countThreeAllocations();
        frames(120);
        counter.stop();

        expect(counter.counts).toEqual(NO_ALLOCATIONS);
        expect(pick).not.toHaveBeenCalled();
        expect(placement.hover()).not.toBeNull();
      });

      it('picks on every frame while the planet turns under the mouse', () => {
        TestBed.inject(CameraControlsService).key({
          code: 'ArrowLeft',
          key: 'ArrowLeft',
          down: true,
        });

        frames(30);

        expect(pick.mock.calls.length).toBeGreaterThanOrEqual(29);
      });
    });
  });
});
