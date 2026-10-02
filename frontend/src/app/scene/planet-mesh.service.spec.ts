import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { NullSceneRenderer } from './null-scene-renderer';
import { PlanetMeshService, planetRadius } from './planet-mesh.service';
import { PickingService } from './picking.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';

describe('planetRadius', () => {
  it('is 1 at level 1 and grows by 0.15 per level', () => {
    expect(planetRadius(1)).toBe(1);
    expect(planetRadius(2)).toBeCloseTo(1.15, 10);
    expect(planetRadius(5)).toBeCloseTo(1.6, 10);
  });
});

describe('PlanetMeshService', () => {
  let planet: PlanetMeshService;
  let scene: SceneService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SceneService,
        PickingService,
        PlanetMeshService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    planet = TestBed.inject(PlanetMeshService);
    scene = TestBed.inject(SceneService);
  });

  it('puts a flat-shaded, low-poly planet in the planet group', () => {
    const material = planet.mesh.material as THREE.MeshLambertMaterial;

    expect(planet.mesh.parent).toBe(scene.planetGroup);
    expect(planet.mesh.geometry.getAttribute('position').count / 3).toBe(320);
    expect(material.flatShading).toBe(true);
    expect(material.vertexColors).toBe(true);
  });

  it('colours each face as one, mostly green with a few patches of sand and water', () => {
    const colour = planet.mesh.geometry.getAttribute('color');
    const faces: string[] = [];
    for (let vertex = 0; vertex < colour.count; vertex += 3) {
      const corners = [0, 1, 2].map((i) =>
        new THREE.Color().fromBufferAttribute(colour, vertex + i).getHexString(),
      );
      expect(new Set(corners).size).toBe(1);
      faces.push(corners[0]);
    }
    const share = (hex: string) => faces.filter((face) => face === hex).length / faces.length;
    const sand = share(new THREE.Color('#ead59c').getHexString());
    const water = share(new THREE.Color('#86c9e8').getHexString());

    expect(sand).toBeGreaterThan(0.03);
    expect(water).toBeGreaterThan(0.03);
    expect(sand + water).toBeLessThan(0.25);
    expect(new Set(faces).size).toBeGreaterThanOrEqual(5);
  });

  it('follows the radius level', () => {
    const render = vi.spyOn(scene, 'requestRender');

    planet.setRadiusLevel(3);

    expect(planet.radius).toBeCloseTo(1.3, 10);
    expect(planet.mesh.scale.toArray()).toEqual([1.3, 1.3, 1.3].map((r) => expect.closeTo(r, 10)));
    expect(render).toHaveBeenCalled();
  });

  it('can be picked as the planet', () => {
    scene.resize(800, 600);

    expect(TestBed.inject(PickingService).pick({ x: 400, y: 300 })?.kind).toBe('planet');
  });
});
