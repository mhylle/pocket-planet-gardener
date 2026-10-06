import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import * as THREE from 'three';
import { CloudState, cloudAt } from '../core/helpers/cloud-rules';
import { sunAngleAt } from '../core/helpers/sun-model';
import { STEP_ARC, SurfacePoint, toVector } from '../core/helpers/surface-coords';
import { DEFAULT_GAME_CONFIG } from '../core/models/game-config';
import { PlanetSnapshotDto } from '../core/models/planet-snapshot';
import { PlanetStore } from '../core/services/planet-store.service';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../testing/fake-motion';
import { MOSSY } from '../testing/garden-fixtures';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';
import {
  CLOUD_HEIGHT,
  OUTLINE_COLOUR,
  SUN_DISTANCE,
  SkyService,
  cloudLook,
  cloudTunables,
} from './sky.service';

const NOW = new Date(MOSSY.serverTime);
const FULL: CloudState = { id: 'cloud-1', lat: 0, lon: 0, water: 1, at: MOSSY.serverTime };
const LOW: CloudState = { id: 'cloud-2', lat: 20, lon: 120, water: 0.1, at: MOSSY.serverTime };

describe('SkyService', () => {
  let scene: SceneService;
  let store: PlanetStore;
  let picking: PickingService;
  let sky: SkyService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SceneService,
        PickingService,
        SkyService,
        FAKE_MOTION_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    store = TestBed.inject(PlanetStore);
    picking = TestBed.inject(PickingService);
    show({ clouds: [FULL, LOW] });
    sky = TestBed.inject(SkyService);
    TestBed.tick();
  });

  afterEach(() => vi.useRealTimers());

  const show = (changes: Partial<PlanetSnapshotDto>) => {
    store.setSnapshot({ ...MOSSY, ...changes });
    TestBed.tick();
  };
  /** Where an object is, in the planet's own coordinates. */
  const local = (object: THREE.Object3D) =>
    scene.planetGroup.worldToLocal(object.getWorldPosition(new THREE.Vector3()));
  const at = (point: SurfacePoint, distance: number) => {
    const { x, y, z } = toVector(point, distance);
    return new THREE.Vector3(x, y, z);
  };
  const outlineOf = (object: THREE.Object3D) =>
    object.children.find((child) => child.name === 'outline') as THREE.Mesh | undefined;

  it('floats each cloud high over where it is now, pickable by its id', () => {
    expect(sky.clouds()).toEqual([
      { id: 'cloud-1', name: 'Cloud 1', lat: 0, lon: 0, water: 1 },
      { id: 'cloud-2', name: 'Cloud 2', lat: 20, lon: 120, water: 0.1 },
    ]);
    expect(local(sky.cloudMesh('cloud-1')!).distanceTo(at(FULL, CLOUD_HEIGHT))).toBeLessThan(1e-6);
    expect(local(sky.cloudMesh('cloud-2')!).distanceTo(at(LOW, CLOUD_HEIGHT))).toBeLessThan(1e-6);
    // On the hour the sun stands further out in front of the first cloud; moved behind the
    // planet, it shows the cloud between the camera and the middle of the planet.
    expect(picking.pick({ x: 400, y: 300 })?.kind).toBe('sun');
    show({
      clouds: [FULL, LOW],
      sun: { angle: 180, overrideAngle: 180, overrideAt: NOW.toISOString() },
    });
    expect(picking.pick({ x: 400, y: 300 })).toMatchObject({ kind: 'cloud', id: 'cloud-1' });
  });

  it('drifts the clouds on and refills them once a second, by the cloud rules', () => {
    vi.advanceTimersByTime(10_000);

    const later = new Date(NOW.getTime() + 10_000);
    const tunables = cloudTunables(DEFAULT_GAME_CONFIG);
    const [full, low] = sky.clouds();
    expect(full).toMatchObject(cloudAt(FULL, later, tunables));
    expect(low).toMatchObject(cloudAt(LOW, later, tunables));
    // Six degrees a minute, and a sixtieth of a tank a second.
    expect(full.lon).toBeCloseTo(1, 9);
    expect(low.water).toBeCloseTo(0.1 + 10 / 60, 9);
  });

  it('shows a cloud with little water smaller and paler (GRD-02 AC2)', () => {
    const full = sky.cloudMesh('cloud-1')!;
    const low = sky.cloudMesh('cloud-2')!;

    expect(low.scale.x).toBeLessThan(full.scale.x * 0.7);
    expect((low.material as THREE.Material).opacity).toBeLessThan(
      (full.material as THREE.Material).opacity * 0.6,
    );
    expect(cloudLook(0).size).toBeLessThan(cloudLook(0.5).size);
    expect(cloudLook(0.5).opacity).toBeLessThan(cloudLook(1).opacity);
  });

  it('stands the sun over its angle, with the light shining from it (GRD-03 AC1)', () => {
    const drifting = sunAngleAt(NOW, 60, null, 5);
    expect(sky.sunAngle()).toBeCloseTo(drifting, 9);

    show({
      clouds: [FULL, LOW],
      sun: { angle: 90, overrideAngle: 90, overrideAt: NOW.toISOString() },
    });

    expect(sky.sunAngle()).toBeCloseTo(90, 9);
    const east = at({ lat: 0, lon: 90 }, 1);
    expect(local(sky.sun).distanceTo(east.clone().multiplyScalar(SUN_DISTANCE))).toBeLessThan(1e-6);
    expect(scene.sunLight.position.clone().normalize().distanceTo(east)).toBeLessThan(1e-6);
    // Out of the way now, so the middle of the view shows the first cloud.
    expect(picking.pick({ x: 400, y: 300 })?.kind).toBe('cloud');
  });

  it('moves the sun and its light at once while held, and back when let go', () => {
    sky.holdSun(200);

    const held = at({ lat: 0, lon: 200 }, 1);
    expect(sky.sunAngle()).toBe(200);
    expect(scene.sunLight.position.clone().normalize().distanceTo(held)).toBeLessThan(1e-6);

    sky.letGoSun();

    expect(sky.sunAngle()).toBeCloseTo(sunAngleAt(NOW, 60, null, 5), 9);
  });

  it('keeps a held cloud where it is put, whatever the snapshot says, until let go', () => {
    sky.holdCloud('cloud-1', { lat: 10, lon: 30 });
    show({ clouds: [{ ...FULL, water: 0.5 }, LOW] });
    vi.advanceTimersByTime(5000);

    expect(sky.cloud('cloud-1')).toMatchObject({ lat: 10, lon: 30 });
    expect(sky.cloud('cloud-1')!.water).toBeCloseTo(0.5 + 5 / 60, 9);
    expect(
      local(sky.cloudMesh('cloud-1')!).distanceTo(at({ lat: 10, lon: 30 }, CLOUD_HEIGHT)),
    ).toBeLessThan(1e-6);

    sky.letGoCloud('cloud-1');

    expect(sky.cloud('cloud-1')!.lon).toBeCloseTo(0.5, 9);
  });

  it('rains under a raining cloud, onto a wet patch the size of the rain reach', () => {
    expect(sky.rainOf('cloud-1')).toBeNull();
    expect(sky.wetPatchOf('cloud-1')).toBeNull();

    sky.setRaining('cloud-1', true);

    const rain = sky.rainOf('cloud-1')!;
    expect(rain.parent).toBe(sky.group);
    // The streaks fall along the line from the cloud down to the ground under it.
    const column = new THREE.Vector3(0, 1, 0).applyQuaternion(rain.quaternion);
    expect(column.distanceTo(at(FULL, 1))).toBeLessThan(1e-6);
    const wet = sky.wetPatchOf('cloud-1')!;
    expect(local(wet).normalize().distanceTo(at(FULL, 1))).toBeLessThan(1e-6);
    expect(wet.scale.x).toBeCloseTo(DEFAULT_GAME_CONFIG.rainRadiusSteps * STEP_ARC, 9);

    sky.setRaining('cloud-1', false);
    expect(sky.rainOf('cloud-1')).toBeNull();
    expect(rain.parent).toBeNull();
    expect(wet.parent).toBeNull();
  });

  it('lets no rain fall with reduced motion, but still shows where it lands (SET-03)', () => {
    TestBed.inject(FakeMotionPreference).reduced.set(true);

    sky.setRaining('cloud-1', true);

    expect(sky.rainOf('cloud-1')).toBeNull();
    expect(sky.wetPatchOf('cloud-1')).not.toBeNull();
  });

  it('stops the falling rain within a second of motion being reduced', () => {
    sky.setRaining('cloud-1', true);
    expect(sky.rainOf('cloud-1')).not.toBeNull();

    TestBed.inject(FakeMotionPreference).reduced.set(true);
    vi.advanceTimersByTime(1000);

    expect(sky.rainOf('cloud-1')).toBeNull();
    expect(sky.wetPatchOf('cloud-1')).not.toBeNull();
  });

  it('outlines the selected cloud or the sun, and nothing once deselected (SET-05 AC2)', () => {
    sky.select({ kind: 'cloud', id: 'cloud-2' });

    const outline = outlineOf(sky.cloudMesh('cloud-2')!)!;
    expect((outline.material as THREE.MeshBasicMaterial).color.getHexString()).toBe(
      OUTLINE_COLOUR.slice(1),
    );
    expect(outline.scale.x).toBeGreaterThan(1);

    sky.select({ kind: 'sun' });
    expect(outlineOf(sky.cloudMesh('cloud-2')!)).toBeUndefined();
    expect(outlineOf(sky.sun)).toBe(outline);

    sky.select(null);
    expect(outline.parent).toBeNull();
  });
});
