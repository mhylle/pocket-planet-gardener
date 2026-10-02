import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import * as THREE from 'three';
import type { MockInstance } from 'vitest';
import { toVector } from '../core/helpers/surface-coords';
import { PlanetStore } from '../core/services/planet-store.service';
import { SyncService } from '../core/services/sync.service';
import { MOSSY } from '../testing/garden-fixtures';
import { CameraControlsService } from './camera-controls.service';
import { InputService } from './input.service';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SCENE_PROVIDERS } from './scene.providers';
import { SceneService } from './scene.service';
import { SUN_DISTANCE, SkyService } from './sky.service';
import { SUN_SEND_MS, SunDragController } from './sun-drag.controller';

describe('SunDragController', () => {
  let scene: SceneService;
  let store: PlanetStore;
  let sky: SkyService;
  let picking: PickingService;
  let sun: SunDragController;
  let canvas: HTMLCanvasElement;
  let send: MockInstance<SyncService['send']>;
  let sent: { at: number; angle: number }[];

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
    store = TestBed.inject(PlanetStore);
    // On the hour the drifting sun stands over longitude 0, between the camera and the planet.
    store.setSnapshot(MOSSY);
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    TestBed.inject(CameraControlsService).reducedMotion = true;
    sky = TestBed.inject(SkyService);
    picking = TestBed.inject(PickingService);
    sun = TestBed.inject(SunDragController);
    sent = [];
    // Answers like the server: the snapshot names the angle the sun was put at, and when.
    send = vi.spyOn(TestBed.inject(SyncService), 'send').mockImplementation(async ({ body }) => {
      const { angle } = body as { angle: number };
      sent.push({ at: Date.now(), angle });
      const now = new Date().toISOString();
      store.setSnapshot({ ...MOSSY, sun: { angle, overrideAngle: angle, overrideAt: now } });
      return { snapshot: store.snapshot()!, events: [] };
    });
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
  /** The longitude under a canvas point, out where the sun stands, from 0 up to 360. */
  const longitudeAt = (at: { x: number; y: number }) => {
    const { lon } = picking.sphereAt(at, SUN_DISTANCE, { orNearest: true })!;
    return (lon + 360) % 360;
  };
  const lightDirection = () => scene.sunLight.position.clone().normalize();
  const towards = (angle: number) => {
    const { x, y, z } = toVector({ lat: 0, lon: angle }, 1);
    return new THREE.Vector3(x, y, z);
  };

  it('puts the sun over the longitude under the pointer, the light with it, at once', () => {
    const start = scene.planetGroup.quaternion.clone();
    expect(picking.pick({ x: 400, y: 300 })?.kind).toBe('sun');

    pointer('pointerdown', { x: 400, y: 300 });
    pointer('pointermove', { x: 520, y: 300 });

    const angle = longitudeAt({ x: 520, y: 300 });
    expect(angle).toBeGreaterThan(5);
    expect(angle).toBeLessThan(90);
    expect(sky.sunAngle()).toBeCloseTo(angle, 9);
    expect(lightDirection().distanceTo(towards(angle))).toBeLessThan(1e-6);
    // The drag moved the sun, not the planet.
    expect(scene.planetGroup.quaternion.angleTo(start)).toBe(0);
  });

  it('tells the server at most twice a second while dragging, and the last angle on release', async () => {
    pointer('pointerdown', { x: 400, y: 300 });
    for (let step = 1; step <= 40; step++) {
      pointer('pointermove', { x: 400 + step * 4, y: 300 });
      await vi.advanceTimersByTimeAsync(50);
    }
    const whileDragging = [...sent];
    pointer('pointerup', { x: 560, y: 300 });
    await vi.advanceTimersByTimeAsync(0);

    // Two seconds of dragging: at the start, then every half second.
    expect(whileDragging).toHaveLength(5);
    whileDragging.slice(1).forEach(({ at }, i) => {
      expect(at - whileDragging[i].at).toBeGreaterThanOrEqual(SUN_SEND_MS);
    });
    const finalAngle = longitudeAt({ x: 560, y: 300 });
    expect(sent.at(-1)!.angle).toBeCloseTo(finalAngle, 9);
    expect(send.mock.calls.every(([command]) => command.path === '/garden/sun')).toBe(true);
  });

  it('follows the snapshot again once the server has the angle, which holds it there', async () => {
    pointer('pointerdown', { x: 400, y: 300 });
    pointer('pointermove', { x: 480, y: 300 });
    pointer('pointerup', { x: 480, y: 300 });
    await vi.advanceTimersByTimeAsync(0);
    const angle = longitudeAt({ x: 480, y: 300 });

    store.setSnapshot({ ...store.snapshot()! });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sky.sunAngle()).toBeCloseTo(angle, 6);
  });

  it('moves ten degrees at a time for the keyboard, sending at most twice a second', async () => {
    sun.nudge(10);
    sun.nudge(10);
    sun.nudge(-5);

    expect(sky.sunAngle()).toBe(15);
    expect(sent.map(({ angle }) => angle)).toEqual([10]);

    sun.flush();
    await vi.advanceTimersByTimeAsync(0);

    expect(sent.map(({ angle }) => angle)).toEqual([10, 15]);
  });
});
