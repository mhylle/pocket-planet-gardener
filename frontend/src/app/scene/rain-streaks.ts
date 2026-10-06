import * as THREE from 'three';

export const RAIN_COLOUR = '#3a78c2';

const STREAKS = 40;
/** A streak's length and how fast it falls, in planet radii and radii per second. */
const LENGTH = 0.12;
const SPEED = 1.1;
/** Spreads the streaks evenly over the column, in angle and in phase. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const GOLDEN_RATIO = (Math.sqrt(5) - 1) / 2;

/**
 * Rain under a cloud (GRD-02 AC1): short streaks falling down a column from just below the
 * cloud to the ground. Built for a planet of radius 1 with the cloud straight up the y axis,
 * from height top, over a column spread wide; the sky stands it under its cloud. The streaks
 * stand still until fall() moves them.
 */
export class RainStreaks {
  readonly lines: THREE.LineSegments;
  private readonly drops: { x: number; z: number; phase: number }[];

  constructor(
    private readonly top: number,
    spread: number,
  ) {
    this.drops = Array.from({ length: STREAKS }, (_, i) => {
      const out = spread * Math.sqrt((i + 0.5) / STREAKS);
      return {
        x: out * Math.cos(i * GOLDEN_ANGLE),
        z: out * Math.sin(i * GOLDEN_ANGLE),
        phase: (i * GOLDEN_RATIO) % 1,
      };
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
    this.lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: RAIN_COLOUR, transparent: true, opacity: 0.9 }),
    );
    this.lines.name = 'rain';
    this.fall(0);
  }

  /** Puts every streak where it is after falling for a time in seconds; runs every frame. */
  fall(seconds: number): void {
    const span = this.top - 1 - LENGTH;
    const position = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.drops.length; i++) {
      const { x, z, phase } = this.drops[i];
      const y = this.top - ((phase * span + seconds * SPEED) % span);
      position.setXYZ(i * 2, x, y, z);
      position.setXYZ(i * 2 + 1, x, y - LENGTH, z);
    }
    position.needsUpdate = true;
    this.lines.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.lines.removeFromParent();
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}
