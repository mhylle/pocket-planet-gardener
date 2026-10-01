import { InjectionToken } from '@angular/core';

/** The drawing surface behind the 3D scene. Specs swap in a renderer that needs no WebGL. */
export interface SceneRenderer {
  attach(canvas: HTMLCanvasElement): void;
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
}

export const SCENE_RENDERER = new InjectionToken<SceneRenderer>('SCENE_RENDERER');
