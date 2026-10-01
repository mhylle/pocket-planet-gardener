import { SceneRenderer } from './scene-renderer';

/** Draws nothing. For specs that run in jsdom, where WebGL is not available. */
export class NullSceneRenderer implements SceneRenderer {
  attach(_canvas: HTMLCanvasElement): void {}

  resize(_width: number, _height: number): void {}

  render(): void {}

  dispose(): void {}
}
