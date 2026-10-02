import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import * as THREE from 'three';
import type { MockInstance } from 'vitest';
import { CloudState } from '../core/helpers/cloud-rules';
import { RainResponse } from '../core/models/planet-snapshot';
import { PlanetStore } from '../core/services/planet-store.service';
import { Command, SyncService } from '../core/services/sync.service';
import { MOSSY } from '../testing/garden-fixtures';
import { CameraControlsService } from './camera-controls.service';
import { CloudDragController } from './cloud-drag.controller';
import { InputService } from './input.service';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SCENE_PROVIDERS } from './scene.providers';
import { SceneService } from './scene.service';
import { SkyService } from './sky.service';

const FRONT: CloudState = { id: 'cloud-1', lat: 0, lon: 0, water: 1, at: MOSSY.serverTime };
const AWAY: CloudState = { id: 'cloud-2', lat: 20, lon: 120, water: 1, at: MOSSY.serverTime };

describe('CloudDragController', () => {
  let scene: SceneService;
  let sky: SkyService;
  let picking: PickingService;
  let clouds: CloudDragController;
  let canvas: HTMLCanvasElement;
  let send: MockInstance<SyncService['send']>;
  let cloudEmpty: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MOSSY.serverTime));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    const store = TestBed.inject(PlanetStore);
    // The sun stands behind the planet, out of the way.
    store.setSnapshot({
      ...MOSSY,
      clouds: [FRONT, AWAY],
      sun: { angle: 180, overrideAngle: 180, overrideAt: MOSSY.serverTime },
    });
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    TestBed.inject(CameraControlsService).reducedMotion = true;
    sky = TestBed.inject(SkyService);
    picking = TestBed.inject(PickingService);
    clouds = TestBed.inject(CloudDragController);
    cloudEmpty = false;
    send = vi
      .spyOn(TestBed.inject(SyncService), 'send')
      .mockImplementation(
        async () => ({ snapshot: store.snapshot()!, events: [], cloudEmpty }) as RainResponse,
      );
    canvas = document.createElement('canvas');
    // jsdom has no pointer capture.
    canvas.setPointerCapture = vi.fn();
    document.body.append(canvas);
    TestBed.inject(InputService).connect(canvas);
    TestBed.tick();
  });

  afterEach(() => {
    canvas.remove();
    vi.useRealTimers();
  });

  const pointer = (type: string, { x, y }: { x: number; y: number }) =>
    canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y }));
  /** Where an object shows on the 800 by 600 canvas. */
  const screenOf = (object: THREE.Object3D) => {
    scene.scene.updateMatrixWorld();
    scene.camera.updateMatrixWorld();
    const { x, y } = object.getWorldPosition(new THREE.Vector3()).project(scene.camera);
    return { x: (x + 1) * 400, y: (1 - y) * 300 };
  };
  const commands = (path: string): Command[] =>
    send.mock.calls.map(([command]) => command).filter((command) => command.path === path);
  const rains = () => commands('/garden/rain');
  const grabFront = () => pointer('pointerdown', screenOf(sky.cloudMesh('cloud-1')!));

  it('rains once a second while a cloud is held over the surface (GRD-02 AC1)', async () => {
    grabFront();
    await vi.advanceTimersByTimeAsync(3200);

    expect(rains()).toHaveLength(3);
    expect(rains()[0]).toEqual({
      method: 'POST',
      path: '/garden/rain',
      body: {
        cloudId: 'cloud-1',
        lat: expect.closeTo(0, 6),
        lon: expect.closeTo(0, 6),
        seconds: 1,
      },
    });
    expect(clouds.held()).toBe('cloud-1');
    expect(sky.rainOf('cloud-1')).not.toBeNull();
  });

  it('follows the pointer over the surface and rains where the pointer is', async () => {
    const spot = { x: 470, y: 340 };
    const below = picking.sphereAt(spot, 1)!;

    grabFront();
    pointer('pointermove', spot);
    await vi.advanceTimersByTimeAsync(1000);

    expect(sky.cloud('cloud-1')).toMatchObject(below);
    expect(rains()[0].body).toMatchObject({ lat: below.lat, lon: below.lon });
  });

  it('stops raining on release and tells the server where it was let go (AC3)', async () => {
    const spot = { x: 470, y: 340 };
    const below = picking.sphereAt(spot, 1)!;

    grabFront();
    pointer('pointermove', spot);
    await vi.advanceTimersByTimeAsync(1500);
    pointer('pointerup', spot);
    await vi.advanceTimersByTimeAsync(3000);

    expect(rains()).toHaveLength(1);
    expect(commands('/garden/clouds/cloud-1/position')).toEqual([
      { method: 'POST', path: '/garden/clouds/cloud-1/position', body: below },
    ]);
    expect(clouds.held()).toBeNull();
    expect(sky.rainOf('cloud-1')).toBeNull();
  });

  it('stops raining when the server says the cloud ran dry (AC2)', async () => {
    const dry: string[] = [];
    clouds.ranDry.subscribe((id) => dry.push(id));
    cloudEmpty = true;

    grabFront();
    await vi.advanceTimersByTimeAsync(1000);
    expect(clouds.raining()).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);

    expect(rains()).toHaveLength(1);
    expect(dry).toEqual(['cloud-1']);
    expect(sky.rainOf('cloud-1')).toBeNull();
    // Still held, so it can be moved on.
    expect(clouds.held()).toBe('cloud-1');
  });

  it('waits without raining while the cloud is held out over open sky', async () => {
    grabFront();
    pointer('pointermove', { x: 3, y: 3 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(rains()).toHaveLength(0);
    expect(sky.cloud('cloud-1')).toMatchObject({ lat: 0, lon: 0 });

    pointer('pointermove', { x: 420, y: 300 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(rains()).toHaveLength(1);
  });

  it('never turns the planet while a cloud is dragged, though a drag elsewhere does', () => {
    const start = scene.planetGroup.quaternion.clone();
    const from = screenOf(sky.cloudMesh('cloud-1')!);

    pointer('pointerdown', from);
    for (let step = 1; step <= 10; step++) {
      pointer('pointermove', { x: from.x + step * 10, y: from.y + step * 5 });
    }
    pointer('pointerup', { x: from.x + 100, y: from.y + 50 });

    expect(scene.planetGroup.quaternion.angleTo(start)).toBe(0);

    pointer('pointerdown', { x: 400, y: 450 });
    pointer('pointermove', { x: 450, y: 450 });
    pointer('pointerup', { x: 450, y: 450 });

    expect(scene.planetGroup.quaternion.angleTo(start)).toBeGreaterThan(0);
  });

  it('holds a cloud for the keyboard, moving it a step at a time and raining on request', async () => {
    expect(clouds.grab('cloud-2')).toBe(true);
    clouds.moveBy(5, -5);
    expect(sky.cloud('cloud-2')).toMatchObject({ lat: 25, lon: 115 });

    await vi.advanceTimersByTimeAsync(2000);
    expect(rains()).toHaveLength(0);
    clouds.setRaining(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(rains()).toHaveLength(2);

    await clouds.release();

    expect(commands('/garden/clouds/cloud-2/position')[0].body).toEqual({ lat: 25, lon: 115 });
    expect(clouds.grab('cloud-9')).toBe(false);
  });

  it('lets go of an untouched cloud without a word to the server', async () => {
    clouds.grab('cloud-2');
    await clouds.release();

    expect(send).not.toHaveBeenCalled();
  });
});
