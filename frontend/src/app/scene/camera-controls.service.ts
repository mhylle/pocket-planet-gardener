import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as THREE from 'three';
import { STEP_ARC, SurfacePoint, toVector } from '../core/helpers/surface-coords';
import { DragInput, InputService, KeyInput, PinchInput, WheelInput } from './input.service';
import { PlanetMeshService } from './planet-mesh.service';
import { SceneService } from './scene.service';

/** How fast a held arrow or W/A/S/D key turns the planet when zoomed far out, in rad/s. */
export const KEY_TURN_SPEED = 1.6;
/** The sky around the planet, where clouds and the sun live, as a multiple of its radius. */
export const SKY_SHELL_RADIUS = 2.4;
/** At the near limit a single plant, one step across, is this share of the screen height. */
const NEAR_PLANT_SHARE = 0.4;
/** Room to spare around the sky at the far limit. */
const FAR_MARGIN = 1.05;
/** Where the zoom starts, from 0 (near limit) to 1 (far limit). */
const START_ZOOM = 0.75;
/** Zoom change per wheel pixel; one notch of a mouse wheel is about 100 pixels. */
const WHEEL_ZOOM_PER_PIXEL = 0.0005;
/** Zoom change per press of plus or minus. */
const KEY_ZOOM_STEP = 0.08;
/** How quickly the zoom catches up with a wheel or key, as a time constant in seconds. */
const ZOOM_EASE_SECONDS = 0.08;
/** How quickly a flung planet slows down: its spin falls to 1/e in 1/DAMPING seconds. */
const DAMPING = 2.5;
/** A spin slower than this, in rad/s, stops. */
const MIN_SPIN = 0.02;
/** How much of the recent drag speed a fling keeps, as a time constant in seconds. */
const SPIN_SMOOTHING_SECONDS = 0.05;
const FOCUS_SECONDS = 0.8;

type Direction = 'left' | 'right' | 'up' | 'down';

const TURN_KEYS = new Map<string, Direction>([
  ['ArrowLeft', 'left'],
  ['KeyA', 'left'],
  ['ArrowRight', 'right'],
  ['KeyD', 'right'],
  ['ArrowUp', 'up'],
  ['KeyW', 'up'],
  ['ArrowDown', 'down'],
  ['KeyS', 'down'],
]);

/** Faces the camera: the camera sits on the +z axis. */
const FRONT = new THREE.Vector3(0, 0, 1);

/**
 * Turning and zooming the planet (NAV-01, NAV-02). Drags and keys turn the planet group by
 * small rotations about the camera's right and up axes, applied in world space, so there is
 * no angle where it flips or sticks. A released drag keeps spinning and slows down. Zoom is a
 * position between the near and far limits, so it stays inside them when the window or the
 * planet changes size. With reducedMotion there is no spin after a drag and no swoops.
 */
@Injectable()
export class CameraControlsService {
  private readonly sceneService = inject(SceneService);
  private readonly planet = inject(PlanetMeshService);
  private readonly camera = this.sceneService.camera;
  private readonly group = this.sceneService.planetGroup;

  /** Read once at start; the settings take this over later (SET-03). */
  reducedMotion = prefersReducedMotion();

  private zoom = START_ZOOM;
  private zoomTarget = START_ZOOM;
  private dragging = false;
  /** Rotation dragged since the last frame, as an axis scaled by the angle. */
  private readonly dragged = new THREE.Vector3();
  /** The current spin, as an axis scaled by rad/s. */
  private readonly spin = new THREE.Vector3();
  /** The codes of the turn keys held down. */
  private readonly heldTurnKeys = new Set<string>();
  private focus: { from: THREE.Quaternion; to: THREE.Quaternion; elapsed: number } | null = null;
  private readonly angles = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();

  constructor() {
    const input = inject(InputService);
    input.drag.pipe(takeUntilDestroyed()).subscribe((step) => this.drag(step));
    input.dragEnd.pipe(takeUntilDestroyed()).subscribe(() => this.release());
    input.pinch.pipe(takeUntilDestroyed()).subscribe((step) => this.pinch(step));
    input.wheel.pipe(takeUntilDestroyed()).subscribe((step) => this.wheel(step));
    input.key.pipe(takeUntilDestroyed()).subscribe((key) => this.key(key));
    this.sceneService.onFrame((dt) => this.update(dt));
    this.placeCamera();
  }

  /** The camera's distance from the planet centre. */
  get distance(): number {
    const { near, far } = this.zoomLimits();
    const r = this.planet.radius;
    return r + (near - r) * ((far - r) / (near - r)) ** this.zoom;
  }

  /** The nearest and farthest the camera may be from the planet centre. */
  zoomLimits(): { near: number; far: number } {
    const r = this.planet.radius;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const plantWidth = r * STEP_ARC;
    const near = r + plantWidth / (NEAR_PLANT_SHARE * 2 * tanHalfFov);
    // The sky must fit across the narrower side of the screen.
    const narrowHalfFov = Math.atan(tanHalfFov * Math.min(1, this.camera.aspect));
    const far = (FAR_MARGIN * SKY_SHELL_RADIUS * r) / Math.sin(narrowHalfFov);
    return { near, far };
  }

  /** Turns the planet so the point faces the camera, gliding there unless instant. */
  focusOn(point: SurfacePoint, { instant = false }: { instant?: boolean } = {}): void {
    const { x, y, z } = toVector(point, 1);
    const facing = new THREE.Vector3(x, y, z).applyQuaternion(this.group.quaternion);
    const to = new THREE.Quaternion()
      .setFromUnitVectors(facing, FRONT)
      .multiply(this.group.quaternion);
    this.spin.set(0, 0, 0);
    if (instant || this.reducedMotion) {
      this.focus = null;
      this.group.quaternion.copy(to);
      this.sceneService.requestRender();
      return;
    }
    this.focus = { from: this.group.quaternion.clone(), to, elapsed: 0 };
    this.sceneService.requestFrame();
  }

  drag({ dx, dy }: DragInput): void {
    if (!this.dragging) {
      this.dragging = true;
      // Grabbing the planet stops it.
      this.spin.set(0, 0, 0);
      this.dragged.set(0, 0, 0);
    }
    this.focus = null;
    // Pixels map to an angle so the surface right under the camera follows the pointer.
    const perPixel = this.radiansPerPixel();
    this.angles.set(dy * perPixel, dx * perPixel, 0);
    this.turn(this.angles);
    this.dragged.add(this.angles);
    this.sceneService.requestFrame();
  }

  /** The drag let go: the planet spins on with the speed it had, unless reducedMotion. */
  release(): void {
    this.dragging = false;
    if (this.reducedMotion) {
      this.spin.set(0, 0, 0);
    }
    this.sceneService.requestFrame();
  }

  pinch({ scale }: PinchInput): void {
    this.spin.set(0, 0, 0);
    const { near, far } = this.zoomLimits();
    const r = this.planet.radius;
    // Fingers twice as far apart halve the height above the surface.
    this.zoomTo(this.zoomTarget - Math.log(scale) / Math.log((far - r) / (near - r)), true);
  }

  wheel({ delta }: WheelInput): void {
    this.zoomTo(this.zoomTarget + delta * WHEEL_ZOOM_PER_PIXEL, false);
  }

  key({ code, key, down }: KeyInput): void {
    if (TURN_KEYS.has(code)) {
      if (down) {
        this.heldTurnKeys.add(code);
        this.focus = null;
        this.spin.set(0, 0, 0);
      } else {
        this.heldTurnKeys.delete(code);
      }
      this.sceneService.requestFrame();
      return;
    }
    if (!down) {
      return;
    }
    if (key === '+' || key === '=') {
      this.zoomTo(this.zoomTarget - KEY_ZOOM_STEP, false);
    } else if (key === '-') {
      this.zoomTo(this.zoomTarget + KEY_ZOOM_STEP, false);
    }
  }

  /** Moves everything on by dt seconds; runs every frame. */
  update(dt: number): void {
    const horizontal = this.heldTurn('right') - this.heldTurn('left');
    const vertical = this.heldTurn('down') - this.heldTurn('up');
    if (horizontal || vertical) {
      const angle = this.keyTurnSpeed() * dt;
      this.turn(this.angles.set(vertical * angle, horizontal * angle, 0));
      this.sceneService.requestFrame();
    }

    if (this.dragging) {
      if (dt > 0) {
        const blend = 1 - Math.exp(-dt / SPIN_SMOOTHING_SECONDS);
        this.spin.lerp(this.dragged.divideScalar(dt), blend);
      }
      this.dragged.set(0, 0, 0);
      // Keeps measuring while the pointer is held still, so a pause before letting go stops it.
      this.sceneService.requestFrame();
    } else if (this.spin.lengthSq() > 0) {
      this.turn(this.angles.copy(this.spin).multiplyScalar(dt));
      this.spin.multiplyScalar(Math.exp(-DAMPING * dt));
      if (this.spin.length() < MIN_SPIN) {
        this.spin.set(0, 0, 0);
      } else {
        this.sceneService.requestFrame();
      }
    }

    if (this.focus) {
      this.focus.elapsed += dt;
      const t = Math.min(1, this.focus.elapsed / FOCUS_SECONDS);
      this.group.quaternion.slerpQuaternions(this.focus.from, this.focus.to, t * t * (3 - 2 * t));
      this.focus = t < 1 ? this.focus : null;
      this.sceneService.requestRender();
    }

    if (this.zoom !== this.zoomTarget) {
      this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-dt / ZOOM_EASE_SECONDS));
      if (Math.abs(this.zoomTarget - this.zoom) < 1e-4) {
        this.zoom = this.zoomTarget;
      }
      this.sceneService.requestRender();
    }
    this.placeCamera();
  }

  /** Turns the planet group by an axis scaled by the angle, in world space. */
  private turn(angles: THREE.Vector3): void {
    const angle = angles.length();
    if (angle === 0) {
      return;
    }
    this.rotation.setFromAxisAngle(this.axis.copy(angles).divideScalar(angle), angle);
    this.group.quaternion.premultiply(this.rotation).normalize();
    this.sceneService.requestRender();
  }

  private zoomTo(zoom: number, instant: boolean): void {
    this.zoomTarget = THREE.MathUtils.clamp(zoom, 0, 1);
    if (instant || this.reducedMotion) {
      this.zoom = this.zoomTarget;
      this.placeCamera();
    }
    this.sceneService.requestRender();
  }

  /**
   * The camera looks down -z with y up and never turns, so its right and up axes are world x
   * and y; only its distance changes. The limits move with the window shape and the planet
   * size, so the distance is worked out afresh every frame.
   */
  private placeCamera(): void {
    this.camera.position.set(0, 0, this.distance);
  }

  /** The angle that moves the surface point nearest the camera by one pixel on screen. */
  private radiansPerPixel(): number {
    const r = this.planet.radius;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return (2 * (this.distance - r) * tanHalfFov) / (this.sceneService.height * r);
  }

  /** Slower when zoomed in, so the surface never rushes past. */
  private keyTurnSpeed(): number {
    const height = this.distance - this.planet.radius;
    return (KEY_TURN_SPEED * height) / (height + this.planet.radius);
  }

  /** 1 while any key for the direction is held (an arrow and its letter may both be). */
  private heldTurn(direction: Direction): number {
    return [...this.heldTurnKeys].some((code) => TURN_KEYS.get(code) === direction) ? 1 : 0;
  }
}

function prefersReducedMotion(): boolean {
  // jsdom, where the specs run, has no matchMedia.
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
