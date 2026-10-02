import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as THREE from 'three';
import { toVector } from '../core/helpers/surface-coords';
import { CatalogueService } from '../core/services/catalogue.service';
import { PlacementService } from '../core/services/placement.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { CATALOGUE, MOSSY, plantAt } from '../testing/garden-fixtures';
import { NullSceneRenderer } from './null-scene-renderer';
import { GHOST_ALLOWED, GHOST_REFUSED, PlacementGhostService } from './placement-ghost.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';

describe('PlacementGhostService', () => {
  let placement: PlacementService;
  let ghost: THREE.Group;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SceneService,
        PlacementService,
        PlacementGhostService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    TestBed.inject(PlanetStore).setSnapshot({ ...MOSSY, plants: [plantAt('clover-1', 0, 0)] });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    placement = TestBed.inject(PlacementService);
    ghost = TestBed.inject(PlacementGhostService).ghost;
    TestBed.tick();
  });

  const [footprint, model] = [0, 1].map((i) => () => ghost.children[i] as THREE.Object3D);
  const tint = () => ((model() as THREE.Mesh).material as THREE.MeshBasicMaterial).color;

  it('is part of the planet and hidden without a selection', () => {
    placement.setHover({ lat: 20, lon: 20 });
    TestBed.tick();

    expect(ghost.parent).toBe(TestBed.inject(SceneService).planetGroup);
    expect(ghost.visible).toBe(false);
  });

  it('stands at the preview point, tinted as allowed on a free spot', () => {
    placement.select({ itemType: 'clover', kind: 'seed' });
    placement.setHover({ lat: 20, lon: 20 });
    TestBed.tick();

    const { x, y, z } = toVector({ lat: 20, lon: 20 }, 1);
    expect(ghost.visible).toBe(true);
    expect(ghost.position.distanceTo(new THREE.Vector3(x, y, z))).toBeLessThan(1e-9);
    expect(tint().equals(GHOST_ALLOWED)).toBe(true);
    expect(footprint().scale.x).toBe(1);
  });

  it('turns to the refused tint over a taken spot', () => {
    placement.select({ itemType: 'clover', kind: 'seed' });
    placement.setHover({ lat: 0, lon: 2 });
    TestBed.tick();

    expect(placement.preview()).toBe('occupied-plant');
    expect(tint().equals(GHOST_REFUSED)).toBe(true);
  });

  it('shows a decoration on a disc as wide as its footprint', () => {
    placement.select({ itemType: 'clover', kind: 'seed' });
    placement.setHover({ lat: 40, lon: 40 });
    TestBed.tick();
    const seedModel = (model() as THREE.Mesh).geometry;

    placement.select({ itemType: 'pond', kind: 'decoration' });
    TestBed.tick();

    expect(footprint().scale.x).toBe(3);
    expect((model() as THREE.Mesh).geometry).not.toBe(seedModel);
  });
});
