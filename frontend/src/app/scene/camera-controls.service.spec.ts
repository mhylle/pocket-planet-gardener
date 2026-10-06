import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { STEP_ARC, SurfacePoint, toVector } from '../core/helpers/surface-coords';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../testing/fake-motion';
import { CameraControlsService, KEY_TURN_SPEED, SKY_SHELL_RADIUS } from './camera-controls.service';
import { NullSceneRenderer } from './null-scene-renderer';
import { PlanetMeshService } from './planet-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SCENE_PROVIDERS } from './scene.providers';
import { SceneService } from './scene.service';

const FRAME = 1 / 60;
const FRONT = new THREE.Vector3(0, 0, 1);

/** The same numbers every run, so a failure can be replayed. */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('CameraControlsService', () => {
  let controls: CameraControlsService;
  let scene: SceneService;
  let group: THREE.Group;
  let camera: THREE.PerspectiveCamera;
  let motion: FakeMotionPreference;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SCENE_PROVIDERS,
        FAKE_MOTION_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    controls = TestBed.inject(CameraControlsService);
    motion = TestBed.inject(FakeMotionPreference);
    group = scene.planetGroup;
    camera = scene.camera;
  });

  const frames = (n: number, dt = FRAME) => {
    for (let i = 0; i < n; i++) {
      controls.update(dt);
    }
  };
  /** The point on the planet, in its own coordinates, that faces the camera now. */
  const facingPoint = () => FRONT.clone().applyQuaternion(group.quaternion.clone().invert());
  /** Where a point of the planet is in the world now. */
  const inWorld = (local: THREE.Vector3) => local.clone().applyQuaternion(group.quaternion);
  const facing = (point: SurfacePoint) => {
    const { x, y, z } = toVector(point, 1);
    return inWorld(new THREE.Vector3(x, y, z));
  };
  const turnKey = (code: string, down: boolean) => controls.key({ code, key: code, down });
  const radius = () => TestBed.inject(PlanetMeshService).radius;

  describe('turning', () => {
    it('never flips or sticks over 1000 random drags (NAV-01 AC3)', () => {
      const random = seededRandom(7);
      for (let i = 0; i < 1000; i++) {
        controls.drag({ dx: (random() - 0.5) * 600, dy: (random() - 0.5) * 600 });
        controls.update(FRAME);

        const q = group.quaternion;
        expect([q.x, q.y, q.z, q.w].every(Number.isFinite)).toBe(true);
        expect(q.length()).toBeCloseTo(1, 9);
        const cameraUp = camera.up.clone().applyQuaternion(camera.quaternion);
        expect(cameraUp.y).toBeGreaterThan(0.999);

        // Wherever the planet has got to, right is still right and down is still down.
        const front = facingPoint();
        controls.drag({ dx: 6, dy: 0 });
        const right = inWorld(front);
        expect(right.x).toBeGreaterThan(0);
        expect(Math.abs(right.y)).toBeLessThan(1e-9);

        const next = facingPoint();
        controls.drag({ dx: 0, dy: 6 });
        const down = inWorld(next);
        expect(down.y).toBeLessThan(0);
        expect(Math.abs(down.x)).toBeLessThan(1e-9);
      }
      expect(Number.isFinite(camera.position.z)).toBe(true);
    });

    it('moves the surface facing the camera along with the pointer', () => {
      const front = facingPoint().multiplyScalar(radius());

      controls.drag({ dx: 10, dy: 0 });
      camera.updateMatrixWorld();
      const onScreen = inWorld(front).project(camera);

      expect((onScreen.x * scene.width) / 2).toBeCloseTo(10, 1);
    });

    it('spins on after a drag and slows to a smooth stop (NAV-01 AC1)', () => {
      for (let i = 0; i < 10; i++) {
        controls.drag({ dx: 8, dy: 0 });
        controls.update(FRAME);
      }
      controls.release();

      const atRelease = group.quaternion.clone();
      controls.update(FRAME);
      const firstStep = atRelease.angleTo(group.quaternion);
      expect(firstStep).toBeGreaterThan(0);

      frames(60);
      const later = group.quaternion.clone();
      controls.update(FRAME);
      expect(later.angleTo(group.quaternion)).toBeLessThan(firstStep);

      frames(600);
      const resting = group.quaternion.clone();
      controls.update(FRAME);
      expect(resting.angleTo(group.quaternion)).toBe(0);
    });

    it('does not spin on when the drag paused before letting go', () => {
      for (let i = 0; i < 10; i++) {
        controls.drag({ dx: 8, dy: 0 });
        controls.update(FRAME);
      }
      frames(30);
      controls.release();

      const atRelease = group.quaternion.clone();
      frames(60);

      expect(atRelease.angleTo(group.quaternion)).toBeLessThan(1e-3);
    });

    it('stops at once on release with reducedMotion', () => {
      motion.reduced.set(true);
      for (let i = 0; i < 10; i++) {
        controls.drag({ dx: 8, dy: 0 });
        controls.update(FRAME);
      }
      controls.release();

      const atRelease = group.quaternion.clone();
      frames(60);

      expect(atRelease.angleTo(group.quaternion)).toBe(0);
    });

    it('turns at a fixed rate while a key is held, whatever the frame rate (NAV-01 AC2)', () => {
      const height = controls.distance - radius();
      const rate = (KEY_TURN_SPEED * height) / (height + radius());
      const start = group.quaternion.clone();

      turnKey('ArrowRight', true);
      frames(60);
      expect(start.angleTo(group.quaternion)).toBeCloseTo(rate, 9);

      frames(30, 1 / 30);
      expect(start.angleTo(group.quaternion)).toBeCloseTo(2 * rate, 9);

      turnKey('ArrowRight', false);
      const released = group.quaternion.clone();
      frames(60);
      expect(released.angleTo(group.quaternion)).toBe(0);
    });

    it.each([
      ['ArrowRight', 'x', 1],
      ['KeyD', 'x', 1],
      ['ArrowLeft', 'x', -1],
      ['KeyA', 'x', -1],
      ['ArrowUp', 'y', 1],
      ['KeyW', 'y', 1],
      ['ArrowDown', 'y', -1],
      ['KeyS', 'y', -1],
    ] as const)('turns the planet the way %s points', (code, axis, sign) => {
      const front = facingPoint();

      turnKey(code, true);
      frames(10);

      expect(Math.sign(inWorld(front)[axis])).toBe(sign);
    });

    it('keeps turning while the other key for the same way is still held', () => {
      turnKey('ArrowLeft', true);
      turnKey('KeyA', true);
      turnKey('ArrowLeft', false);

      const before = group.quaternion.clone();
      frames(10);

      expect(before.angleTo(group.quaternion)).toBeGreaterThan(0);
    });

    it('reports how far each drag and held key turns the planet', () => {
      const angles: number[] = [];
      controls.turned.subscribe((angle) => angles.push(angle));

      const before = group.quaternion.clone();
      controls.drag({ dx: 40, dy: 0 });
      expect(angles).toHaveLength(1);
      expect(angles[0]).toBeCloseTo(before.angleTo(group.quaternion), 9);

      turnKey('ArrowUp', true);
      frames(3);
      expect(angles).toHaveLength(4);
    });
  });

  describe('zoom', () => {
    const settle = () => frames(120);

    it('stops close enough for one plant to fill a good part of the screen (NAV-02 AC1)', () => {
      for (let i = 0; i < 40; i++) {
        controls.wheel({ delta: -500 });
      }
      settle();
      const { near } = controls.zoomLimits();
      const visibleHeight =
        2 * (controls.distance - radius()) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

      expect(controls.distance).toBeCloseTo(near, 9);
      expect((radius() * STEP_ARC) / visibleHeight).toBeCloseTo(0.4, 6);
    });

    it.each([
      [800, 600],
      [400, 800],
    ])('stops far enough to show the whole sky on a %ix%i screen (NAV-02 AC2)', (w, h) => {
      scene.resize(w, h);
      for (let i = 0; i < 40; i++) {
        controls.wheel({ delta: 500 });
      }
      settle();
      const { far } = controls.zoomLimits();
      const halfHeight = THREE.MathUtils.degToRad(camera.fov / 2);
      const halfWidth = Math.atan(Math.tan(halfHeight) * camera.aspect);
      const skyHalfAngle = Math.asin((SKY_SHELL_RADIUS * radius()) / controls.distance);

      expect(controls.distance).toBeCloseTo(far, 9);
      expect(skyHalfAngle).toBeLessThan(Math.min(halfHeight, halfWidth));
    });

    it('never leaves the limits, whatever the mix of wheel, pinch and keys', () => {
      const random = seededRandom(11);
      for (let i = 0; i < 1000; i++) {
        const pick = random();
        if (pick < 0.3) {
          controls.wheel({ delta: (random() - 0.5) * 2000 });
        } else if (pick < 0.6) {
          controls.pinch({ scale: 0.2 + random() * 4 });
        } else {
          controls.key({ code: 'Equal', key: random() < 0.5 ? '+' : '-', down: true });
        }
        controls.update(FRAME);

        const { near, far } = controls.zoomLimits();
        expect(controls.distance).toBeGreaterThanOrEqual(near - 1e-9);
        expect(controls.distance).toBeLessThanOrEqual(far + 1e-9);
        expect(camera.position.z).toBe(controls.distance);
      }
    });

    it('follows a planet that grows, staying inside the new limits', () => {
      for (let i = 0; i < 40; i++) {
        controls.wheel({ delta: -500 });
      }
      settle();

      TestBed.inject(PlanetMeshService).setRadiusLevel(3);
      controls.update(FRAME);

      expect(controls.distance).toBeCloseTo(controls.zoomLimits().near, 9);
    });

    it('zooms in with plus or equals and out with minus', () => {
      const start = controls.distance;

      controls.key({ code: 'Equal', key: '+', down: true });
      settle();
      const afterPlus = controls.distance;
      controls.key({ code: 'Equal', key: '=', down: true });
      settle();
      const afterEquals = controls.distance;
      controls.key({ code: 'Minus', key: '-', down: true });
      controls.key({ code: 'Minus', key: '-', down: true });
      controls.key({ code: 'Minus', key: '-', down: true });
      settle();

      expect(afterPlus).toBeLessThan(start);
      expect(afterEquals).toBeLessThan(afterPlus);
      expect(controls.distance).toBeGreaterThan(start);
    });

    it('zooms out when the wheel scrolls down and in when it scrolls up', () => {
      const start = controls.distance;

      controls.wheel({ delta: 100 });
      settle();
      const out = controls.distance;
      controls.wheel({ delta: -300 });
      settle();

      expect(out).toBeGreaterThan(start);
      expect(controls.distance).toBeLessThan(start);
    });

    it('halves the height above the surface when the fingers spread to twice as far', () => {
      const height = controls.distance - radius();

      controls.pinch({ scale: 2 });

      expect(controls.distance - radius()).toBeCloseTo(height / 2, 9);
    });

    it('glides to a new zoom, or jumps there with reducedMotion', () => {
      const start = controls.distance;
      controls.wheel({ delta: 200 });
      controls.update(FRAME);
      const gliding = controls.distance;
      settle();

      expect(gliding).toBeGreaterThan(start);
      expect(gliding).toBeLessThan(controls.distance);

      motion.reduced.set(true);
      controls.wheel({ delta: -200 });
      expect(controls.distance).toBeCloseTo(start, 9);
    });
  });

  describe('focusOn', () => {
    const points: SurfacePoint[] = [
      { lat: 0, lon: 0 },
      { lat: 45, lon: 120 },
      { lat: -89.9, lon: -30 },
      { lat: 90, lon: 0 },
      { lat: -12.5, lon: 180 },
    ];

    beforeEach(() => {
      controls.drag({ dx: 137, dy: -61 });
      controls.drag({ dx: -20, dy: 240 });
      controls.release();
      controls.update(FRAME);
    });

    it('turns any point to face the camera at once when asked', () => {
      for (const point of points) {
        controls.focusOn(point, { instant: true });

        expect(facing(point).distanceTo(FRONT)).toBeLessThan(1e-6);
      }
    });

    it('turns the point that faces away all the way round', () => {
      const away = facingPoint().negate();
      const { lat, lon } = {
        lat: THREE.MathUtils.radToDeg(Math.asin(away.y)),
        lon: THREE.MathUtils.radToDeg(Math.atan2(away.x, away.z)),
      };

      controls.focusOn({ lat, lon }, { instant: true });

      expect(facing({ lat, lon }).distanceTo(FRONT)).toBeLessThan(1e-6);
    });

    it('glides to the point over a moment', () => {
      const point = points[1];

      controls.focusOn(point);
      controls.update(FRAME);
      expect(facing(point).distanceTo(FRONT)).toBeGreaterThan(1e-3);

      frames(60);
      expect(facing(point).distanceTo(FRONT)).toBeLessThan(1e-6);
    });

    it('jumps to the point with reducedMotion', () => {
      motion.reduced.set(true);

      controls.focusOn(points[1]);

      expect(facing(points[1]).distanceTo(FRONT)).toBeLessThan(1e-6);
    });

    it('gives way to a drag', () => {
      controls.focusOn(points[1]);
      controls.update(FRAME);
      controls.drag({ dx: 30, dy: 0 });
      controls.release();
      frames(120);

      expect(facing(points[1]).distanceTo(FRONT)).toBeGreaterThan(1e-3);
    });
  });
});
