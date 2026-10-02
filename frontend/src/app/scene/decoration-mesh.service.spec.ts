import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { SurfacePoint, toVector } from '../core/helpers/surface-coords';
import { DecorationDto } from '../core/models/planet-snapshot';
import { PlanetStore } from '../core/services/planet-store.service';
import { MOSSY } from '../testing/garden-fixtures';
import { DecorationMeshService } from './decoration-mesh.service';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { PlanetMeshService } from './planet-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';

describe('DecorationMeshService', () => {
  let scene: SceneService;
  let store: PlanetStore;
  let picking: PickingService;
  let decorations: DecorationMeshService;

  const pond: DecorationDto = { id: 'pond-1', type: 'pond', lat: 10, lon: 20 };
  const rock: DecorationDto = { id: 'rock-1', type: 'rock', lat: -40, lon: 150 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SceneService,
        PickingService,
        PlanetMeshService,
        DecorationMeshService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    store = TestBed.inject(PlanetStore);
    picking = TestBed.inject(PickingService);
    TestBed.inject(PlanetMeshService);
    decorations = TestBed.inject(DecorationMeshService);
  });

  const show = (list: DecorationDto[]) => {
    store.setSnapshot({ ...MOSSY, decorations: list });
    TestBed.tick();
  };

  /** Turns the planet so the point faces the camera, then picks the middle of the view. */
  const pickAt = (point: SurfacePoint) => {
    const { x, y, z } = toVector(point, 1);
    scene.planetGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(0, 0, 1),
    );
    return picking.pick({ x: 400, y: 300 });
  };

  it('draws one pickable instance per decoration, one mesh per type', () => {
    show([pond, rock]);

    expect(decorations.meshes.map((mesh) => [mesh.name, mesh.count])).toEqual([
      ['pond', 1],
      ['rock', 1],
    ]);
    expect(pickAt(pond)).toMatchObject({ kind: 'decoration', id: 'pond-1' });
    expect(pickAt(rock)).toMatchObject({ kind: 'decoration', id: 'rock-1' });
  });

  it('follows a move and a put-away', () => {
    show([pond, rock]);
    const moved = { ...rock, lat: 60, lon: -20 };

    show([pond, moved]);
    expect(pickAt(rock)?.kind).toBe('planet');
    expect(pickAt(moved)).toMatchObject({ kind: 'decoration', id: 'rock-1' });

    show([moved]);
    expect(decorations.meshes.map((mesh) => mesh.name)).toEqual(['rock']);
    expect(pickAt(pond)?.kind).toBe('planet');
  });
});
