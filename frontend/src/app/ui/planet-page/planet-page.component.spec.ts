import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlanetDto } from '../../core/models/planet';
import { PlanetService } from '../../core/services/planet.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { ViewStateService } from '../../core/services/view-state.service';
import { PlanetPageComponent } from './planet-page.component';

const mossy: PlanetDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('PlanetPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PlanetPageComponent>;
  let page: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PlanetPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(mossy.id);
    TestBed.inject(ViewStateService).show('planet');
  });

  afterEach(() => http.verify());

  function render() {
    fixture = TestBed.createComponent(PlanetPageComponent);
    page = fixture.nativeElement;
    fixture.detectChanges();
  }

  /** Lets pending promise callbacks run, then waits for the re-render. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const heading = () => page.querySelector('h2')?.textContent?.trim();
  const failWith = (status: number) =>
    http.expectOne('/api/planet').flush({ statusCode: status }, { status, statusText: 'Error' });

  it('shows a planet that is already known without asking the server again', async () => {
    const created = TestBed.inject(PlanetService).create('Mossy');
    http.expectOne({ method: 'POST', url: '/api/planet' }).flush(mossy);
    await created;

    render();
    await fixture.whenStable();

    expect(heading()).toBe('Mossy');
  });

  it('loads the stored planet, showing a calm line while it waits', async () => {
    render();

    expect(page.querySelector('[role="status"]')?.textContent).toContain('Opening your planet');
    http.expectOne({ method: 'GET', url: '/api/planet' }).flush(mossy);
    await settle();

    expect(heading()).toBe('Mossy');
  });

  it('returns to create-planet when the planet has drifted away', async () => {
    render();
    failWith(404);
    await settle();

    expect(localStorage.getItem('ppg.planetId')).toBeNull();
    expect(TestBed.inject(ViewStateService).view()).toBe('create-planet');
  });

  it('offers a retry when the server cannot be reached, keeping the planet id', async () => {
    render();
    failWith(500);
    await settle();

    const alert = page.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("couldn't reach your planet");
    expect(localStorage.getItem('ppg.planetId')).toBe(mossy.id);

    alert.querySelector('button')!.click();
    http.expectOne('/api/planet').flush(mossy);
    await settle();

    expect(heading()).toBe('Mossy');
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });

  it('opens and closes the settings panel', async () => {
    render();
    http.expectOne('/api/planet').flush(mossy);
    await settle();
    const settings = page.querySelector<HTMLButtonElement>(
      'button[aria-controls="settings-panel"]',
    )!;

    expect(settings.getAttribute('aria-expanded')).toBe('false');
    expect(page.querySelector('app-settings-panel')).toBeNull();

    settings.click();
    await fixture.whenStable();
    expect(settings.getAttribute('aria-expanded')).toBe('true');
    expect(page.querySelector('#settings-panel .code')?.textContent).toBe('MOSS2345');

    settings.click();
    await fixture.whenStable();
    expect(page.querySelector('app-settings-panel')).toBeNull();
  });
});
