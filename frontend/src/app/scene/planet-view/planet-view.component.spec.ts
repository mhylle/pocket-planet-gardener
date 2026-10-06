import { ComponentFixture, TestBed } from '@angular/core/testing';
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
