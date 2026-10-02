import { Injectable, inject, signal } from '@angular/core';
import * as THREE from 'three';
import { SCENE_RENDERER } from './scene-renderer';

/** A longer frame (a hidden tab, a busy laptop) counts as this long, so nothing jumps ahead. */
const MAX_FRAME_SECONDS = 0.1;

/** Runs once per frame; dt is the time since the previous frame in seconds (0 on the first). */
export type FrameStep = (dt: number) => void;

/**
 * The 3D scene behind the planet view: camera, lights, the planet group, and the loop that
 * draws them. It draws only on request, so a still planet costs nothing: a frame step that is
 * still moving something asks for the next frame itself. The camera sits on the +z axis
 * looking at the planet centre with y up, and never turns; the planet group turns instead.
 */
@Injectable()
export class SceneService {
  private readonly renderer = inject(SCENE_RENDERER);

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  /** Everything on the planet. Later phases add plants, decorations and creatures here. */
  readonly planetGroup = new THREE.Group();
  /** The warm light that plays the sun. */
  readonly sunLight = new THREE.DirectionalLight(0xfff1d6, 2.4);

  private readonly firstFrameDrawn = signal(false);
  /** True once a frame has been drawn into the attached canvas. */
  readonly ready = this.firstFrameDrawn.asReadonly();

  private readonly steps: FrameStep[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private lastFrameTime: number | null = null;
  private dirty = false;
  private size = { width: 1, height: 1 };

  constructor() {
    this.camera.position.set(0, 0, 3.5);
    this.sunLight.position.set(-3, 4, 5);
    const skyFill = new THREE.HemisphereLight(0xdcefff, 0xd8c39a, 1.3);
    this.scene.add(skyFill, this.sunLight, this.planetGroup);
  }

  /** The canvas width in CSS pixels. */
  get width(): number {
    return this.size.width;
  }

  /** The canvas height in CSS pixels. */
  get height(): number {
    return this.size.height;
  }

  /** Starts drawing into the canvas. Call once it is in the page, from afterNextRender. */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.renderer.attach(canvas);
    this.resize(canvas.clientWidth, canvas.clientHeight);
    // jsdom, where the specs run, has no ResizeObserver.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() =>
        this.resize(canvas.clientWidth, canvas.clientHeight),
      );
      this.resizeObserver.observe(canvas);
    }
    this.requestRender();
  }

  /** Fits the camera and the drawing buffer to a canvas size in CSS pixels. */
  resize(width: number, height: number): void {
    this.size = { width: Math.max(1, width), height: Math.max(1, height) };
    this.camera.aspect = this.size.width / this.size.height;
    this.camera.updateProjectionMatrix();
    this.renderer.resize(this.size.width, this.size.height);
    this.requestRender();
  }

  /** Runs the step on every frame from now on, before the frame is drawn. */
  onFrame(step: FrameStep): void {
    this.steps.push(step);
  }

  /** Draws a frame soon, because something in the scene changed. */
  requestRender(): void {
    this.dirty = true;
    this.requestFrame();
  }

  /** Runs the frame steps once more without drawing, unless one of them asks to draw. */
  requestFrame(): void {
    if (this.canvas && this.frameId === null) {
      this.frameId = requestAnimationFrame((time) => this.frame(time));
    }
  }

  /** Stops drawing and frees what the scene holds on the GPU. attach() may follow again. */
  dispose(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
    this.frameId = null;
    this.lastFrameTime = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.canvas = null;
    this.scene.traverse((object) => {
      const { geometry, material } = object as Partial<THREE.Mesh>;
      geometry?.dispose();
      const materials = Array.isArray(material) ? material : material ? [material] : [];
      materials.forEach((each) => each.dispose());
    });
    this.renderer.dispose();
    this.firstFrameDrawn.set(false);
  }

  private frame(time: number): void {
    this.frameId = null;
    const dt =
      this.lastFrameTime === null
        ? 0
        : Math.min((time - this.lastFrameTime) / 1000, MAX_FRAME_SECONDS);
    this.lastFrameTime = time;
    this.steps.forEach((step) => step(dt));
    if (this.dirty) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
      this.firstFrameDrawn.set(true);
    }
    // No step asked for another frame: the loop rests, and the next one starts afresh.
    if (this.frameId === null) {
      this.lastFrameTime = null;
    }
  }
}
