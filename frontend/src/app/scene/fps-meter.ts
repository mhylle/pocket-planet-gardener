import { PERF_PREFIX } from '../core/helpers/perf';
import { SceneService } from './scene.service';

/** How long each frame-rate reading covers, in ms. */
export const FPS_WINDOW_MS = 5000;

/**
 * A developer's frame-rate meter for the 3D view (NFR-02), loaded only with ?perf=1. Over each
 * 5 s window it logs the average frame rate and the lowest, the rate of the longest frame, such
 * as "[ppg perf] fps avg 58.2 min 41.0 over 5 s". The scene draws only on request, so a planet
 * at rest would read as 0 fps. While the meter runs it asks for a drawn frame on every frame
 * instead, so the scene draws continuously and the reading is what the device can do with the
 * planet, not how often something moved. It allocates nothing per frame.
 */
export class FpsMeter {
  private windowStart: number | null = null;
  private lastFrame = 0;
  private frames = 0;
  private longestFrame = 0;

  constructor(
    private readonly scene: Pick<SceneService, 'onFrame' | 'requestRender'>,
    private readonly log: (line: string) => void,
    private readonly now: () => number = () => performance.now(),
  ) {
    scene.onFrame(() => this.frame());
    scene.requestRender();
  }

  private frame(): void {
    const now = this.now();
    if (this.windowStart === null) {
      this.windowStart = now;
    } else {
      this.frames++;
      this.longestFrame = Math.max(this.longestFrame, now - this.lastFrame);
      const elapsed = now - this.windowStart;
      if (elapsed >= FPS_WINDOW_MS) {
        const average = ((this.frames * 1000) / elapsed).toFixed(1);
        const lowest = (1000 / this.longestFrame).toFixed(1);
        const seconds = Math.round(elapsed / 1000);
        this.log(`${PERF_PREFIX} fps avg ${average} min ${lowest} over ${seconds} s`);
        this.windowStart = now;
        this.frames = 0;
        this.longestFrame = 0;
      }
    }
    this.lastFrame = now;
    // Every frame is drawn while the meter runs, as if something moved all the time.
    this.scene.requestRender();
  }
}
