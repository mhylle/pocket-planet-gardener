import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as THREE from 'three';
import { SurfacePoint } from '../core/helpers/surface-coords';
import { CatalogueService } from '../core/services/catalogue.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { CATALOGUE, MOSSY, creatureAt, plantAt } from '../testing/garden-fixtures';
import { CreatureMeshService } from './creature-mesh.service';
import { standOn } from './low-poly';
import { NullSceneRenderer } from './null-scene-renderer';
import { PlanetMeshService } from './planet-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SCENE_PROVIDERS } from './scene.providers';
import { SceneService } from './scene.service';
import { RING_COLOUR, SelectionRingService } from './selection-ring.service';
import { SkyService } from './sky.service';

/** Relative luminance of an sRGB colour such as "#1f2933" (WCAG 2.1 definition). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('SelectionRingService', () => {
  let store: PlanetStore;
  let ring: SelectionRingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    store = TestBed.inject(PlanetStore);
    store.setSnapshot({
      ...MOSSY,
      plants: [plantAt('clover-1', 10, 20)],
      decorations: [{ id: 'pond-1', type: 'pond', lat: -20, lon: 40 }],
      creatures: [creatureAt('mira', 0, 0)],
    });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(CreatureMeshService);
    ring = TestBed.inject(SelectionRingService);
    TestBed.tick();
  });

  /** The ring stands upright on the point, as an item on it would. */
  function expectOn(point: SurfacePoint) {
    const position = new THREE.Vector3();
    standOn(point, 1, 0).decompose(position, new THREE.Quaternion(), new THREE.Vector3());
    expect(ring.ring.visible).toBe(true);
    expect(ring.ring.position.distanceTo(position)).toBeLessThan(1e-9);
  }

  const band = () => ring.ring.children[0];

  it('is in the planet group and hidden until something is picked', () => {
    expect(ring.ring.parent).toBe(TestBed.inject(SceneService).planetGroup);
    expect(ring.ring.visible).toBe(false);
  });

  it('rings a plant or a decoration on its spot, as wide as its footprint (SET-05 AC2)', () => {
    ring.select({ kind: 'plant', id: 'clover-1' });
    expectOn({ lat: 10, lon: 20 });
    expect(band().scale.x).toBe(1);

    ring.select({ kind: 'decoration', id: 'pond-1' });
    expectOn({ lat: -20, lon: 40 });
    expect(band().scale.x).toBe(3);

    ring.select(null);
    expect(ring.ring.visible).toBe(false);
  });

  it('stands out at 3:1 or better against every colour of the ground, with a white edge', () => {
    const colours = TestBed.inject(PlanetMeshService).mesh.geometry.getAttribute('color');
    const colour = new THREE.Color();
    const ground = new Set<string>();
    for (let i = 0; i < colours.count; i++) {
      ground.add(`#${colour.fromBufferAttribute(colours, i).getHexString()}`);
    }
    const [accent, edge] = band().children.map(
      (mesh) =>
        `#${((mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHexString()}`,
    );

    expect(accent).toBe(RING_COLOUR);
    expect(edge).toBe('#ffffff');
    // Grass, sand and water.
    expect(ground.size).toBeGreaterThanOrEqual(3);
    for (const each of ground) {
      expect(contrast(accent, each)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(accent, edge)).toBeGreaterThanOrEqual(3);
  });

  it('follows a creature as it wanders', () => {
    // Shines on the creature, so it stays awake.
    TestBed.inject(SkyService).holdSun(0);
    const creatures = TestBed.inject(CreatureMeshService);
    const where = () => creatures.creature('mira')!.point;
    ring.select({ kind: 'creature', id: 'mira' });
    expectOn({ lat: 0, lon: 0 });

    for (let i = 0; i < 200 && where().lat === 0 && where().lon === 0; i++) {
      creatures.tick(1);
    }
    expect(where()).not.toEqual({ lat: 0, lon: 0 });
    ring.update();
    expectOn(where());
  });

  it('goes when what it rings goes', () => {
    ring.select({ kind: 'plant', id: 'clover-1' });

    store.setSnapshot({ ...store.snapshot()!, plants: [] });
    TestBed.tick();

    expect(ring.ring.visible).toBe(false);
  });
});
