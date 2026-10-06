import { FPS_WINDOW_MS, FpsMeter } from './fps-meter';
import { FrameStep } from './scene.service';

describe('FpsMeter', () => {
  let steps: FrameStep[];
  let renders: number;
  let lines: string[];
  /** The fake clock, in ms. */
  let now: number;

  beforeEach(() => {
    steps = [];
    renders = 0;
    lines = [];
    now = 1000;
    const scene = {
      onFrame: (step: FrameStep) => steps.push(step),
      requestRender: () => renders++,
    };
    new FpsMeter(scene, (line) => lines.push(line), () => now);
  });

  /** Runs one frame that started ms after the previous one. */
  function frame(ms: number) {
    now += ms;
    steps.forEach((step) => step(ms / 1000));
  }

  it('keeps the scene drawing on every frame, so a planet at rest is measured too (NFR-02)', () => {
    expect(steps).toHaveLength(1);
    expect(renders).toBe(1);

    for (let i = 0; i < 10; i++) {
      frame(16);
    }

    expect(renders).toBe(11);
  });

  it('logs the average and lowest frame rate over each 5 s window', () => {
    frame(0);
    // 299 frames of 16 ms and one of 50 ms: 300 frames in 4.834 s, then the window closes.
    for (let i = 0; i < 299; i++) {
      frame(16);
    }
    frame(50);
    expect(lines).toEqual([]);
    frame(166);

    // 301 frames in 5 s; the longest took 166 ms.
    expect(lines).toEqual(['[ppg perf] fps avg 60.2 min 6.0 over 5 s']);
  });

  it('starts each window afresh', () => {
    frame(0);
    for (let elapsed = 0; elapsed < FPS_WINDOW_MS; elapsed += 20) {
      frame(20);
    }
    for (let elapsed = 0; elapsed < FPS_WINDOW_MS; elapsed += 40) {
      frame(40);
    }

    expect(lines).toEqual([
      '[ppg perf] fps avg 50.0 min 50.0 over 5 s',
      '[ppg perf] fps avg 25.0 min 25.0 over 5 s',
    ]);
  });
});
