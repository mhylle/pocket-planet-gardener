import { InjectionToken } from '@angular/core';
import type { Camera, Scene } from 'three';

/** The drawing surface behind the 3D scene. Specs swap in a renderer that needs no WebGL. */
export interface SceneRenderer {
  attach(canvas: HTMLCanvasElement): void;
  /** The canvas size in CSS pixels. */
  resize(width: number, height: number): void;
  render(scene: Scene, camera: Camera): void;
  /** Frees the drawing surface; attach() may be called again afterwards. */
  dispose(): void;
}

export const SCENE_RENDERER = new InjectionToken<SceneRenderer>('SCENE_RENDERER');
