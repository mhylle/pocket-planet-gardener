import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { MockInstance } from 'vitest';
import { CloudState } from '../../core/helpers/cloud-rules';
import { RainResponse } from '../../core/models/planet-snapshot';
import { PlanetStore } from '../../core/services/planet-store.service';
import { Command, SyncService } from '../../core/services/sync.service';
import { CloudDragController } from '../../scene/cloud-drag.controller';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { SkyService } from '../../scene/sky.service';
import { MOSSY, plantAt } from '../../testing/garden-fixtures';
import { SkyListComponent } from './sky-list.component';

const FULL: CloudState = { id: 'cloud-1', lat: 0, lon: 0, water: 1, at: MOSSY.serverTime };
const LOW: CloudState = { id: 'cloud-2', lat: 20, lon: 120, water: 0.3, at: MOSSY.serverTime };

describe('SkyListComponent', () => {
  let fixture: ComponentFixture<SkyListComponent>;
  let list: HTMLElement;
  let sky: SkyService;
  let send: MockInstance<SyncService['send']>;
  let focusCanvas: MockInstance<SceneService['focusCanvas']>;
  let cloudEmpty: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MOSSY.serverTime));
    TestBed.configureTestingModule({
      imports: [SkyListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    const store = TestBed.inject(PlanetStore);
    // A clover one step east of the first cloud.
    store.setSnapshot({ ...MOSSY, clouds: [FULL, LOW], plants: [plantAt('clover-1', 0, 5)] });
    sky = TestBed.inject(SkyService);
    focusCanvas = vi.spyOn(TestBed.inject(SceneService), 'focusCanvas');
    cloudEmpty = false;
    send = vi
      .spyOn(TestBed.inject(SyncService), 'send')
      .mockImplementation(
        async () => ({ snapshot: store.snapshot()!, events: [], cloudEmpty }) as RainResponse,
      );
    fixture = TestBed.createComponent(SkyListComponent);
    list = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const options = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const labels = () => options().map((option) => option.getAttribute('aria-label'));
  const announced = () => list.querySelector('[aria-live]')!.textContent;
  const press = (option: HTMLElement, key: string) => {
    option.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };
  const focus = (option: HTMLElement) => {
    option.focus();
    fixture.detectChanges();
  };
  const commands = (path: string): Command[] =>
    send.mock.calls.map(([command]) => command).filter((command) => command.path === path);

  it('lists every cloud with its water in words, and the sun, each a Tab stop (GRD-02 AC4)', () => {
    expect(list.querySelector('[role="listbox"]')).not.toBeNull();
    expect(labels()).toEqual(['Cloud 1, full', 'Cloud 2, low', 'Sun']);
    expect(options().map((option) => option.tabIndex)).toEqual([0, 0, 0]);
    // Each status has its own icon as well as its words (SET-04).
    expect(options().every((option) => option.querySelector('svg'))).toBe(true);
  });

  it('selects, outlines and holds the cloud Tab brings the focus to (SET-05 AC2)', () => {
    focus(options()[0]);

    expect(options()[0].getAttribute('aria-selected')).toBe('true');
    expect(options()[1].getAttribute('aria-selected')).toBe('false');
    expect(sky.cloudMesh('cloud-1')!.children.some((child) => child.name === 'outline')).toBe(true);
    expect(TestBed.inject(CloudDragController).held()).toBe('cloud-1');
  });

  it('moves the selected cloud a step per arrow key, saying so every time', () => {
    focus(options()[0]);

    press(options()[0], 'ArrowRight');
    expect(sky.cloud('cloud-1')).toMatchObject({ lat: 0, lon: expect.closeTo(5, 9) });
    const first = announced();
    expect(first).toBe('Cloud 1 moved east. 1 plant below.');

    // The same words again, yet the live region changes, so they are read out again.
    press(options()[0], 'ArrowRight');
    expect(sky.cloud('cloud-1')!.lon).toBeCloseTo(10, 9);
    expect(announced()).not.toBe(first);
    expect(announced()!.trim()).toBe(first);

    press(options()[0], 'ArrowUp');
    press(options()[0], 'ArrowUp');
    expect(sky.cloud('cloud-1')!.lat).toBeCloseTo(10, 9);
    expect(announced()).toBe('Cloud 1 moved north. No plants below.');
  });

  it('starts rain commands with Space, one a second, and stops them with Space again', async () => {
    focus(options()[0]);

    press(options()[0], ' ');
    expect(announced()).toBe('Cloud 1 raining');
    expect(labels()[0]).toBe('Cloud 1, raining');
    await vi.advanceTimersByTimeAsync(2000);
    expect(commands('/garden/rain')).toHaveLength(2);

    press(options()[0], ' ');
    await vi.advanceTimersByTimeAsync(2000);

    expect(announced()).toBe('Cloud 1 stopped raining');
    expect(commands('/garden/rain')).toHaveLength(2);
  });

  it('says so when a raining cloud runs dry', async () => {
    cloudEmpty = true;
    focus(options()[1]);

    press(options()[1], ' ');
    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();

    expect(announced()).toBe('Cloud 2 is empty');
  });

  it('lets go on Escape, sending where the cloud is, and goes back to the canvas', async () => {
    focus(options()[0]);
    press(options()[0], 'ArrowRight');

    press(options()[0], 'Escape');
    await vi.advanceTimersByTimeAsync(0);

    expect(commands('/garden/clouds/cloud-1/position')).toEqual([
      {
        method: 'POST',
        path: '/garden/clouds/cloud-1/position',
        body: { lat: 0, lon: expect.closeTo(5, 9) },
      },
    ]);
    expect(TestBed.inject(CloudDragController).held()).toBeNull();
    expect(announced()).toBe('Cloud 1 let go');
    expect(focusCanvas).toHaveBeenCalled();
  });

  it('lets go of a moved cloud when Tab moves on to the next one', () => {
    focus(options()[0]);
    press(options()[0], 'ArrowDown');

    focus(options()[1]);

    expect(commands('/garden/clouds/cloud-1/position')).toHaveLength(1);
    expect(TestBed.inject(CloudDragController).held()).toBe('cloud-2');
    expect(options()[0].getAttribute('aria-selected')).toBe('false');
  });

  it('moves the sun ten degrees per arrow key and tells the server', () => {
    const sun = options()[2];
    focus(sun);

    press(sun, 'ArrowRight');
    expect(sky.sunAngle()).toBe(10);
    expect(announced()).toBe('Sun moved east');
    expect(commands('/garden/sun')[0].body).toEqual({ angle: 10 });

    press(sun, 'ArrowLeft');
    expect(sky.sunAngle()).toBe(0);
    expect(announced()).toBe('Sun moved west');
  });
});
