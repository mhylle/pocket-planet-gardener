import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { TUTORIAL_FINISHED, TutorialService } from '../../core/services/tutorial.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { MOSSY } from '../../testing/garden-fixtures';
import { TUTORIAL } from '../../testing/tutorial-fixtures';
import { PIP_WAITING_LINE, PipComponent } from './pip.component';

describe('PipComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PipComponent>;
  let page: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PipComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
        PlacementService,
        TutorialService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  /** Shows Pip on a planet at the step, with the script served. */
  async function render(step: number): Promise<void> {
    TestBed.inject(PlanetStore).setSnapshot({ ...MOSSY, tutorialStep: step });
    fixture = TestBed.createComponent(PipComponent);
    page = fixture.nativeElement;
    http.expectOne('/api/tutorial').flush(TUTORIAL);
    await fixture.whenStable();
  }

  /** Lets the queued save go out, checks it names the step and answers it. */
  async function expectSaved(step: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    const req = http.expectOne({ method: 'PATCH', url: '/api/planet/tutorial' });
    expect(req.request.body).toEqual({ step });
    req.flush({ tutorialStep: step });
    await fixture.whenStable();
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.trim();
  const button = (label: string) =>
    [...page.querySelectorAll('button')].find((each) => each.textContent?.trim() === label);
  const announced = () => text('[aria-live="polite"]');

  it('greets a new planet with the welcome and its step number (ONB-01 AC1)', async () => {
    await render(0);

    expect(text('.text')).toBe(TUTORIAL.steps[0].text);
    expect(text('.count')).toBe('Step 1 of 8');
    expect(page.querySelector('aside')?.getAttribute('aria-labelledby')).toBe('pip-name');
  });

  it('moves on and saves step 1 on "Let\'s go", with the keyboard back on the planet', async () => {
    await render(0);
    const focusCanvas = vi.spyOn(TestBed.inject(SceneService), 'focusCanvas');

    button("Let's go")!.click();
    await fixture.whenStable();

    expect(text('.text')).toBe(TUTORIAL.steps[1].text);
    expect(text('.count')).toBe('Step 2 of 8');
    expect(button("Let's go")).toBeUndefined();
    expect(focusCanvas).toHaveBeenCalled();
    await expectSaved(1);
  });

  it('carries on from the step the planet reached (AC4)', async () => {
    await render(4);

    expect(text('.text')).toBe(TUTORIAL.steps[4].text);
    expect(text('.count')).toBe('Step 5 of 8');
    expect(page.querySelectorAll('aside button')).toHaveLength(0);
  });

  it('reads out each new step in the live region', async () => {
    await render(0);
    expect(announced()).toBe(`Pip says: ${TUTORIAL.steps[0].text} Step 1 of 8.`);

    button("Let's go")!.click();
    await fixture.whenStable();

    expect(announced()).toBe(`Pip says: ${TUTORIAL.steps[1].text} Step 2 of 8.`);
    await expectSaved(1);
  });

  it('says goodbye, saves -1 and waits as an "Ask Pip" button (AC3)', async () => {
    await render(7);

    button('Thanks, Pip!')!.click();
    await fixture.whenStable();

    expect(page.querySelector('aside')).toBeNull();
    expect(button('Ask Pip')).toBeDefined();
    expect(announced()).toBe(PIP_WAITING_LINE);
    await expectSaved(TUTORIAL_FINISHED);
  });

  it('starts again from the welcome on "Ask Pip" and saves 0 (ONB-03 AC2)', async () => {
    await render(TUTORIAL_FINISHED);

    button('Ask Pip')!.click();
    await fixture.whenStable();

    expect(text('.text')).toBe(TUTORIAL.steps[0].text);
    expect(document.activeElement).toBe(button("Let's go"));
    await expectSaved(0);
  });

  it('bobs gently, but not when the device asks for less motion (SET-03)', async () => {
    await render(0);
    expect(page.querySelector('aside app-pip-cloud')?.classList).toContain('bob');
    fixture.destroy();

    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    fixture = TestBed.createComponent(PipComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();

    expect(page.querySelector('aside app-pip-cloud')?.classList).not.toContain('bob');
  });

  it("hides Pip's picture from screen readers", async () => {
    await render(0);

    expect(page.querySelector('app-pip-cloud')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows nothing until the script is loaded', async () => {
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    fixture = TestBed.createComponent(PipComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();

    expect(page.querySelector('aside, button')).toBeNull();
    expect(announced()).toBe('');
    http.expectOne('/api/tutorial');
  });
});
