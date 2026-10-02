import * as THREE from 'three';
import { SceneRenderer } from './scene-renderer';

/** Sharper screens than this get no more pixels, which keeps the work down. */
const MAX_PIXEL_RATIO = 2;

/** Draws the scene with WebGL. Each attach() opens a fresh WebGL context, dispose() closes it. */
export class WebGlSceneRenderer implements SceneRenderer {
  private renderer: THREE.WebGLRenderer | null = null;

  attach(canvas: HTMLCanvasElement): void {
    THREE.ColorManagement.enabled = true;
    // Transparent, so the sky gradient behind the canvas shows through.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
  }

  resize(width: number, height: number): void {
    this.renderer?.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    // The canvas keeps the size its styles give it; only the drawing buffer changes.
    this.renderer?.setSize(width, height, false);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer?.render(scene, camera);
  }

  dispose(): void {
    if (!this.renderer) {
      return;
    }
    const gl = this.renderer.getContext();
    this.renderer.dispose();
    // Browsers allow only a few WebGL contexts, so hand this one back now, not at garbage collection.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.renderer = null;
  }
}
