import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { InputService } from '../input.service';
import { NullSceneRenderer } from '../null-scene-renderer';
import { PlanetMeshService } from '../planet-mesh.service';
import { SCENE_RENDERER } from '../scene-renderer';
import { SCENE_PROVIDERS } from '../scene.providers';
import { SceneService } from '../scene.service';
import { PlanetViewComponent } from './planet-view.component';

describe('PlanetViewComponent', () => {
  let renderer: NullSceneRenderer;
  let fixture: ComponentFixture<PlanetViewComponent>;
  let page: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    renderer = new NullSceneRenderer();
    TestBed.configureTestingModule({
      imports: [PlanetViewComponent],
      providers: [SCENE_PROVIDERS, { provide: SCENE_RENDERER, useValue: renderer }],
    });
    fixture = TestBed.createComponent(PlanetViewComponent);
    fixture.componentRef.setInput('name', 'Mossy');
    fixture.componentRef.setInput('radiusLevel', 1);
    page = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const canvas = () => page.querySelector('canvas')!;

  it('draws the planet into its canvas without WebGL', async () => {
    const render = vi.spyOn(renderer, 'render');

    await vi.advanceTimersByTimeAsync(50);

    expect(render).toHaveBeenCalledOnce();
    expect(TestBed.inject(SceneService).ready()).toBe(true);
  });

  it('is a focusable picture named for the planet and its controls', () => {
    expect(canvas().getAttribute('tabindex')).toBe('0');
    expect(canvas().getAttribute('role')).toBe('img');
    expect(canvas().getAttribute('aria-label')).toBe(
      'Mossy, your planet. Drag or use the arrow keys to turn it; ' +
        'scroll or press plus and minus to zoom. ' +
        'Drag a cloud to water, or the sun to light; Tab goes on to the garden and the sky. ' +
        'Enter acts at the middle of the view; press ? for all keys.',
    );
  });

  it('sizes the planet by its radius level', async () => {
    const planet = TestBed.inject(PlanetMeshService);
    expect(planet.radius).toBe(1);

    fixture.componentRef.setInput('radiusLevel', 3);
    fixture.detectChanges();

    expect(planet.radius).toBeCloseTo(1.3, 10);
    expect(planet.mesh.scale.x).toBeCloseTo(1.3, 10);
  });

  it('frees the scene when it closes', () => {
    const dispose = vi.spyOn(TestBed.inject(SceneService), 'dispose');
    const rendererDispose = vi.spyOn(renderer, 'dispose');

    fixture.destroy();

    expect(dispose).toHaveBeenCalledOnce();
    expect(rendererDispose).toHaveBeenCalledOnce();
  });

  describe('the frame-rate meter (NFR-02)', () => {
    const startUrl = location.href;
    let info: MockInstance<typeof console.info>;
    let render: MockInstance<NullSceneRenderer['render']>;

    beforeEach(() => {
      info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      render = vi.spyOn(renderer, 'render');
    });

    afterEach(() => {
      history.replaceState(null, '', startUrl);
      vi.restoreAllMocks();
    });

    const perfLines = () =>
      info.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith('[ppg'));

    it('is absent without ?perf=1: the planet at rest is drawn once', async () => {
      await vi.advanceTimersByTimeAsync(6000);

      expect(render).toHaveBeenCalledOnce();
      expect(perfLines()).toEqual([]);
    });

    it('with ?perf=1 draws every frame and logs the frame rate every 5 s', async () => {
      fixture.destroy();
      history.replaceState(null, '', '?perf=1');
      fixture = TestBed.createComponent(PlanetViewComponent);
      fixture.componentRef.setInput('name', 'Mossy');
      fixture.componentRef.setInput('radiusLevel', 1);
      fixture.detectChanges();
      // The view loads the meter on its own; this waits for the same chunk.
      await import('../fps-meter');
      await vi.advanceTimersByTimeAsync(0);
      render.mockClear();

      await vi.advanceTimersByTimeAsync(5100);

      // About one frame per 16 ms, each drawn.
      expect(render.mock.calls.length).toBeGreaterThan(300);
      expect(perfLines()).toHaveLength(1);
      expect(perfLines()[0]).toMatch(/^\[ppg perf\] fps avg \d+\.\d min \d+\.\d over 5 s$/);
    });
  });

  it('listens to the canvas until it closes', async () => {
    const keys: string[] = [];
    TestBed.inject(InputService).key.subscribe(({ code }) => keys.push(code));
    const element = canvas();
    await vi.advanceTimersByTimeAsync(50);
    const press = () =>
      element.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));

    press();
    fixture.destroy();
    press();

    expect(keys).toEqual(['KeyW']);
  });
});
