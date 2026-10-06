import { pixelRatioFor } from './webgl-scene-renderer';

describe('WebGlSceneRenderer', () => {
  it('draws at most two pixels per CSS pixel, however sharp the screen (NFR-02)', () => {
    expect(pixelRatioFor(1)).toBe(1);
    expect(pixelRatioFor(1.25)).toBe(1.25);
    expect(pixelRatioFor(2)).toBe(2);
    expect(pixelRatioFor(3)).toBe(2);
    expect(pixelRatioFor(4)).toBe(2);
  });
});
