import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { PlanetSnapshotDto } from './core/models/planet-snapshot';
import { DRIFTED_AWAY_NOTICE } from './core/services/planet.service';
import { ViewStateService } from './core/services/view-state.service';
import { NullSceneRenderer } from './scene/null-scene-renderer';
import { SCENE_RENDERER } from './scene/scene-renderer';

const mossy: PlanetSnapshotDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  radiusLevel: 1,
  maxPlants: 60,
  tutorialStep: 0,
  serverTime: '2026-10-01T10:00:00.000Z',
  plants: [],
  decorations: [],
  inventory: [],
  unlocks: [],
  clouds: [],
  sun: { overrideAngle: null, overrideAt: null },
};

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // The planet page asks for the catalogue for the inventory names; these specs do not need it.
    http.match('/api/catalogue');
    http.verify();
  });

  function render() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    /** Lets pending promise callbacks run, then waits for the re-render. */
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    return { fixture, page, settle };
  }

  const heading = (page: HTMLElement) => page.querySelector('h2')?.textContent?.trim();

  function type(page: HTMLElement, selector: string, value: string) {
    const input = page.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('renders the heading and makes no HTTP request without a stored planet', async () => {
    const { fixture, page } = render();
    await fixture.whenStable();

    expect(page.querySelector('main h1')?.textContent).toBe('Pocket Planet Gardener');
    expect(page.querySelector('app-create-planet')).not.toBeNull();
  });

  it('opens the stored planet at startup', async () => {
    localStorage.setItem('ppg.planetId', mossy.id);
    const { page, settle } = render();

    const req = http.expectOne({ method: 'GET', url: '/api/planet' });
    expect(req.request.headers.get('X-Planet-Id')).toBe(mossy.id);
    req.flush(mossy);
    await settle();

    expect(heading(page)).toBe('Mossy');
  });

  it('forgets a planet that drifted away and offers to create one', async () => {
    localStorage.setItem('ppg.planetId', mossy.id);
    const { page, settle } = render();

    http
      .expectOne('/api/planet')
      .flush(
        { statusCode: 404, message: 'This planet has drifted away' },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();

    expect(localStorage.getItem('ppg.planetId')).toBeNull();
    expect(page.querySelector('app-create-planet')).not.toBeNull();
    expect(page.querySelector('[role="status"]')?.textContent?.trim()).toBe(DRIFTED_AWAY_NOTICE);
  });

  it('shows the new planet right after creating it', async () => {
    const { fixture, page, settle } = render();
    type(page, 'app-planet-name-form input', 'Mossy');
    await fixture.whenStable();

    page.querySelector<HTMLButtonElement>('app-planet-name-form button')!.click();
    http.expectOne({ method: 'POST', url: '/api/planet' }).flush(mossy);
    await settle();
    http.expectOne({ method: 'GET', url: '/api/planet' }).flush(mossy);
    await settle();

    expect(heading(page)).toBe('Mossy');
  });

  it('opens a planet by its code and loads it', async () => {
    const { fixture, page, settle } = render();
    type(page, '#planet-code', 'MOSS2345');
    await fixture.whenStable();

    page.querySelector<HTMLButtonElement>('.have-code button')!.click();
    http.expectOne('/api/planet/by-code/MOSS2345').flush({ id: mossy.id });
    await settle();
    http.expectOne({ method: 'GET', url: '/api/planet' }).flush(mossy);
    await settle();

    expect(heading(page)).toBe('Mossy');
  });

  it('follows the view when it changes', async () => {
    const { fixture, page } = render();

    TestBed.inject(ViewStateService).show('admin');
    await fixture.whenStable();

    expect(page.querySelector('main section')?.textContent?.trim()).toBe('Admin tools come later');
  });
});
