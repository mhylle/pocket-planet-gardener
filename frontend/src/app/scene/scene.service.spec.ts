import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { NullSceneRenderer } from './null-scene-renderer';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';

describe('SceneService', () => {
  let renderer: NullSceneRenderer;
  let scene: SceneService;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.useFakeTimers();
    renderer = new NullSceneRenderer();
    TestBed.configureTestingModule({
      providers: [SceneService, { provide: SCENE_RENDERER, useValue: renderer }],
    });
    scene = TestBed.inject(SceneService);
    canvas = document.createElement('canvas');
  });

  afterEach(() => vi.useRealTimers());

  /** Runs the animation frames due in the next n frames of about 16 ms. */
  const frames = (n: number) => vi.advanceTimersByTime(n * 16);

  it('holds a camera on the +z axis, a sky fill and the planet group with the sun in it', () => {
    expect(scene.camera.position.toArray()).toEqual([0, 0, 3.5]);
    expect(scene.scene.children).toContain(scene.planetGroup);
    expect(scene.planetGroup.children).toContain(scene.sunLight);
    expect(scene.scene.children.some((child) => child instanceof THREE.HemisphereLight)).toBe(
      true,
    );
  });

  it('draws once after attaching, then rests until asked again', () => {
    const attach = vi.spyOn(renderer, 'attach');
    const render = vi.spyOn(renderer, 'render');

    scene.attach(canvas);
    expect(attach).toHaveBeenCalledWith(canvas);
    expect(scene.ready()).toBe(false);

    frames(10);
    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledWith(scene.scene, scene.camera);
    expect(scene.ready()).toBe(true);

    scene.requestRender();
    scene.requestRender();
    frames(10);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('draws nothing before it is attached', () => {
    const render = vi.spyOn(renderer, 'render');

    scene.requestRender();
    frames(10);

    expect(render).not.toHaveBeenCalled();
  });

  it('runs frame steps with the frame time while they ask for more, drawing only on request', () => {
    const render = vi.spyOn(renderer, 'render');
    const times: number[] = [];
    scene.onFrame((dt) => {
      times.push(dt);
      if (times.length < 5) {
        scene.requestFrame();
      }
    });

    scene.attach(canvas);
    frames(20);

    expect(times).toHaveLength(5);
    expect(times[0]).toBe(0);
    for (const dt of times.slice(1)) {
      expect(dt).toBeGreaterThan(0.01);
      expect(dt).toBeLessThan(0.02);
    }
    expect(render).toHaveBeenCalledOnce();
  });

  it('fits the camera to the canvas size', () => {
    const resize = vi.spyOn(renderer, 'resize');

    scene.resize(800, 400);

    expect(scene.camera.aspect).toBe(2);
    expect([scene.width, scene.height]).toEqual([800, 400]);
    expect(resize).toHaveBeenCalledWith(800, 400);
  });

  it('frees the renderer, the meshes and the frame loop on dispose', () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    scene.planetGroup.add(new THREE.Mesh(geometry, material));
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const disposeRenderer = vi.spyOn(renderer, 'dispose');
    const render = vi.spyOn(renderer, 'render');
    scene.attach(canvas);
    frames(2);
    scene.requestRender();

    scene.dispose();
    frames(10);

    expect(disposeGeometry).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalled();
    expect(disposeRenderer).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
    expect(scene.ready()).toBe(false);
  });
});
