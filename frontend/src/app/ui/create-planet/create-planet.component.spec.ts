import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GENERIC_ERROR_MESSAGE } from '../../core/helpers/error-message';
import { PlanetDto } from '../../core/models/planet';
import { DRIFTED_AWAY_NOTICE, PlanetService } from '../../core/services/planet.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { ViewStateService } from '../../core/services/view-state.service';
import { CreatePlanetComponent, UNKNOWN_CODE_MESSAGE } from './create-planet.component';

const mossy: PlanetDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('CreatePlanetComponent', () => {
  let fixture: ComponentFixture<CreatePlanetComponent>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [CreatePlanetComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreatePlanetComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  /** Lets pending promise callbacks run, then waits for the re-render. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  const nameField = () => page.querySelector<HTMLInputElement>('app-planet-name-form input')!;
  const createButton = () =>
    page.querySelector<HTMLButtonElement>('app-planet-name-form button[type="submit"]')!;
  const nameError = () =>
    page.querySelector('app-planet-name-form [aria-live="polite"]')!.textContent!.trim();
  const codeField = () => page.querySelector<HTMLInputElement>('#planet-code')!;
  const openButton = () => page.querySelector<HTMLButtonElement>('.have-code button')!;
  const codeError = () => page.querySelector('#planet-code-error')!.textContent!.trim();
  const view = () => TestBed.inject(ViewStateService).view();
  const storedId = () => localStorage.getItem('ppg.planetId');

  describe('creating a planet', () => {
    it('posts the trimmed name, stores the id and shows the planet', async () => {
      await type(nameField(), '  Mossy  ');
      createButton().click();

      const req = http.expectOne({ method: 'POST', url: '/api/planet' });
      expect(req.request.body).toEqual({ name: 'Mossy' });
      req.flush(mossy, { status: 201, statusText: 'Created' });
      await settle();

      expect(storedId()).toBe(mossy.id);
      expect(view()).toBe('planet');
    });

    it("shows the server's message and keeps the typed name when it is refused", async () => {
      await type(nameField(), 'Grumpy');
      createButton().click();

      http
        .expectOne('/api/planet')
        .flush(
          { statusCode: 400, message: 'That name is not very kind. How about another?' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(nameError()).toBe('That name is not very kind. How about another?');
      expect(nameField().value).toBe('Grumpy');
      expect(createButton().disabled).toBe(false);
      expect(storedId()).toBeNull();
      expect(view()).toBe('create-planet');
    });

    it('shows the first message when the server sends a list', async () => {
      await type(nameField(), 'Mossy');
      createButton().click();

      http
        .expectOne('/api/planet')
        .flush(
          { statusCode: 400, message: ['name must be shorter than or equal to 24 characters'] },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(nameError()).toBe('name must be shorter than or equal to 24 characters');
    });

    it('shows a calm line when the server cannot be reached', async () => {
      await type(nameField(), 'Mossy');
      createButton().click();

      http.expectOne('/api/planet').error(new ProgressEvent('error'));
      await settle();

      expect(nameError()).toBe(GENERIC_ERROR_MESSAGE);
      expect(nameField().value).toBe('Mossy');
    });
  });

  describe('opening a planet by code', () => {
    it('is not possible without a code', () => {
      expect(openButton().disabled).toBe(true);
    });

    it('resolves the code, stores the id and shows the planet', async () => {
      await type(codeField(), 'moss2345');
      openButton().click();

      const req = http.expectOne({ method: 'GET', url: '/api/planet/by-code/MOSS2345' });
      req.flush({ id: mossy.id });
      await settle();

      expect(storedId()).toBe(mossy.id);
      expect(view()).toBe('planet');
    });

    it('says kindly when the code is unknown', async () => {
      await type(codeField(), 'NOPE2345');
      openButton().click();

      http
        .expectOne('/api/planet/by-code/NOPE2345')
        .flush({ statusCode: 404, message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
      await settle();

      expect(codeError()).toBe(UNKNOWN_CODE_MESSAGE);
      expect(codeField().value).toBe('NOPE2345');
      expect(storedId()).toBeNull();
      expect(view()).toBe('create-planet');
    });
  });

  it('explains when the stored planet has drifted away', async () => {
    TestBed.inject(PlanetIdentityService).set(mossy.id);
    const loading = TestBed.inject(PlanetService).load();
    http
      .expectOne('/api/planet')
      .flush(
        { statusCode: 404, message: 'This planet has drifted away' },
        { status: 404, statusText: 'Not Found' },
      );
    await loading;
    await settle();

    expect(page.querySelector('[role="status"]')!.textContent!.trim()).toBe(DRIFTED_AWAY_NOTICE);
  });
});
