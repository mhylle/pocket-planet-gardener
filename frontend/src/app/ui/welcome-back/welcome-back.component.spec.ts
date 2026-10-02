import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { MockInstance } from 'vitest';
import { WelcomeBack } from '../../core/models/planet-snapshot';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SyncService } from '../../core/services/sync.service';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { MOSSY } from '../../testing/garden-fixtures';
import { WelcomeBackComponent } from './welcome-back.component';

const WELCOME_BACK: WelcomeBack = {
  summary: [
    { kind: 'blooms', count: 3, text: '3 plants bloomed', focus: { lat: 12, lon: -40 } },
    { kind: 'creatures', count: 1, text: '1 new creature', focus: { lat: -5, lon: 100 } },
    { kind: 'gifts', count: 1, text: '1 gift waiting' },
  ],
};

describe('WelcomeBackComponent', () => {
  let fixture: ComponentFixture<WelcomeBackComponent>;
  let http: HttpTestingController;
  let camera: CameraControlsService;
  let focusOn: MockInstance<CameraControlsService['focusOn']>;
  let focusCanvas: MockInstance<SceneService['focusCanvas']>;
  let page: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [WelcomeBackComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    camera = TestBed.inject(CameraControlsService);
    camera.reducedMotion = false;
    focusOn = vi.spyOn(camera, 'focusOn');
    focusCanvas = vi.spyOn(TestBed.inject(SceneService), 'focusCanvas');
    fixture = TestBed.createComponent(WelcomeBackComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  /** A sync whose response says what changed while the player was away. */
  async function syncWith(welcomeBack?: WelcomeBack) {
    TestBed.inject(SyncService).syncNow();
    http.expectOne('/api/planet/sync').flush({ snapshot: MOSSY, events: [], welcomeBack });
    await fixture.whenStable();
  }

  const dialog = () => page.querySelector<HTMLElement>('[role="dialog"]');
  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
  const lineButton = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('.lines button')].find(
      (button) => text(button) === label,
    )!;
  const dismissButton = () => page.querySelector<HTMLButtonElement>('button.dismiss')!;

  it('shows nothing without a welcome-back summary (TIM-03 AC2)', async () => {
    await syncWith(undefined);

    expect(dialog()).toBeNull();
    expect(text(page)).toBe('');
  });

  it('shows "Welcome back!" and the lines in order as a labelled dialog with the focus (TIM-03 AC1)', async () => {
    await syncWith(WELCOME_BACK);

    expect(dialog()!.getAttribute('aria-labelledby')).toBe('welcome-back-title');
    expect(text(page.querySelector('#welcome-back-title')!)).toBe('Welcome back!');
    expect([...page.querySelectorAll('.lines li')].map(text)).toEqual([
      '3 plants bloomed',
      '· 1 new creature',
      '· 1 gift waiting',
    ]);
    expect(text(page.querySelector('.lines')!)).toBe(
      '3 plants bloomed · 1 new creature · 1 gift waiting',
    );
    expect(document.activeElement).toBe(dialog());
  });

  it('makes only the lines with a place to show into buttons', async () => {
    await syncWith(WELCOME_BACK);

    expect([...page.querySelectorAll('.lines button')].map(text)).toEqual([
      '3 plants bloomed',
      '1 new creature',
    ]);
  });

  it('turns the planet to a line when it is picked (TIM-03 AC3)', async () => {
    await syncWith(WELCOME_BACK);

    lineButton('1 new creature').click();

    expect(focusOn).toHaveBeenCalledExactlyOnceWith({ lat: -5, lon: 100 }, { instant: false });
    expect(dialog()).not.toBeNull();
  });

  it('turns the planet at once under reduced motion', async () => {
    camera.reducedMotion = true;
    await syncWith(WELCOME_BACK);

    lineButton('3 plants bloomed').click();

    expect(focusOn).toHaveBeenCalledExactlyOnceWith({ lat: 12, lon: -40 }, { instant: true });
  });

  it('hides on Dismiss and gives the focus back to the planet', async () => {
    await syncWith(WELCOME_BACK);

    dismissButton().click();
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(TestBed.inject(PlanetStore).welcomeBack()).toBeNull();
    expect(focusCanvas).toHaveBeenCalledOnce();
  });

  it('hides on Escape and gives the focus back to the planet', async () => {
    await syncWith(WELCOME_BACK);

    lineButton('3 plants bloomed').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(focusCanvas).toHaveBeenCalledOnce();
  });
});
