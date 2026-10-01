import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlanetDto } from '../models/planet';
import { DRIFTED_AWAY_NOTICE, PlanetService } from './planet.service';
import { PlanetIdentityService } from './planet-identity.service';
import { ViewStateService } from './view-state.service';

const mossy: PlanetDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('PlanetService', () => {
  let http: HttpTestingController;
  let planets: PlanetService;
  let identity: PlanetIdentityService;
  let views: ViewStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    planets = TestBed.inject(PlanetService);
    identity = TestBed.inject(PlanetIdentityService);
    views = TestBed.inject(ViewStateService);
  });

  afterEach(() => http.verify());

  function failWith(url: string, status: number, message: string | string[]) {
    http
      .expectOne(url)
      .flush({ statusCode: status, message, error: 'Error' }, { status, statusText: 'Error' });
  }

  describe('create', () => {
    it('posts the trimmed name, stores the id and shows the planet', async () => {
      const done = planets.create('  Mossy  ');

      const req = http.expectOne({ method: 'POST', url: '/api/planet' });
      expect(req.request.body).toEqual({ name: 'Mossy' });
      req.flush(mossy);
      await done;

      expect(identity.planetId()).toBe(mossy.id);
      expect(localStorage.getItem('ppg.planetId')).toBe(mossy.id);
      expect(planets.planet()).toEqual(mossy);
      expect(views.view()).toBe('planet');
    });

    it('rejects and changes nothing when the server refuses the name', async () => {
      const done = planets.create('Bad');
      failWith('/api/planet', 400, 'Let us pick a kinder name');

      await expect(done).rejects.toMatchObject({ status: 400 });
      expect(identity.planetId()).toBeNull();
      expect(planets.planet()).toBeNull();
      expect(views.view()).toBe('create-planet');
    });
  });

  describe('load', () => {
    beforeEach(() => identity.set(mossy.id));

    it('fetches the stored planet with its id in the header', async () => {
      const done = planets.load();

      const req = http.expectOne({ method: 'GET', url: '/api/planet' });
      expect(req.request.headers.get('X-Planet-Id')).toBe(mossy.id);
      req.flush(mossy);
      await done;

      expect(planets.planet()).toEqual(mossy);
    });

    it.each([404, 400])('forgets the id and shows create-planet on %i', async (status) => {
      views.show('planet');
      const done = planets.load();
      failWith('/api/planet', status, 'This planet has drifted away');
      await done;

      expect(identity.planetId()).toBeNull();
      expect(localStorage.getItem('ppg.planetId')).toBeNull();
      expect(planets.planet()).toBeNull();
      expect(planets.notice()).toBe(DRIFTED_AWAY_NOTICE);
      expect(views.view()).toBe('create-planet');
    });

    it('rejects and keeps the id on other failures', async () => {
      const done = planets.load();
      failWith('/api/planet', 500, 'Internal server error');

      await expect(done).rejects.toMatchObject({ status: 500 });
      expect(identity.planetId()).toBe(mossy.id);
    });
  });

  it('rename patches the trimmed name and keeps the returned planet', async () => {
    identity.set(mossy.id);
    const done = planets.rename(' Fernhill ');

    const req = http.expectOne({ method: 'PATCH', url: '/api/planet/name' });
    expect(req.request.body).toEqual({ name: 'Fernhill' });
    req.flush({ ...mossy, name: 'Fernhill', version: 2 });
    await done;

    expect(planets.planet()?.name).toBe('Fernhill');
  });

  describe('openByCode', () => {
    it('resolves the code, stores the id, clears the notice and shows the planet', async () => {
      identity.set(mossy.id);
      const drifted = planets.load();
      failWith('/api/planet', 404, 'This planet has drifted away');
      await drifted;

      const done = planets.openByCode(' moss2345 ');
      const req = http.expectOne({ method: 'GET', url: '/api/planet/by-code/MOSS2345' });
      expect(req.request.headers.has('X-Planet-Id')).toBe(false);
      req.flush({ id: mossy.id });
      await done;

      expect(identity.planetId()).toBe(mossy.id);
      expect(planets.notice()).toBeNull();
      expect(views.view()).toBe('planet');
    });

    it('rejects and stores nothing for an unknown code', async () => {
      const done = planets.openByCode('NOPE2345');
      failWith('/api/planet/by-code/NOPE2345', 404, 'Not Found');

      await expect(done).rejects.toMatchObject({ status: 404 });
      expect(identity.planetId()).toBeNull();
      expect(views.view()).toBe('create-planet');
    });
  });

  it('leave forgets the planet without calling the server', () => {
    identity.set(mossy.id);
    views.show('planet');

    planets.leave();

    expect(localStorage.getItem('ppg.planetId')).toBeNull();
    expect(planets.planet()).toBeNull();
    expect(planets.notice()).toBeNull();
    expect(views.view()).toBe('create-planet');
  });

  describe('deletePlanet', () => {
    beforeEach(() => {
      identity.set(mossy.id);
      views.show('planet');
    });

    it('sends the confirmation, then forgets the planet', async () => {
      const done = planets.deletePlanet();

      const req = http.expectOne({ method: 'DELETE', url: '/api/planet' });
      expect(req.request.body).toEqual({ confirm: 'DELETE' });
      expect(req.request.headers.get('X-Planet-Id')).toBe(mossy.id);
      req.flush(null, { status: 204, statusText: 'No Content' });
      await done;

      expect(localStorage.getItem('ppg.planetId')).toBeNull();
      expect(views.view()).toBe('create-planet');
    });

    it('rejects and keeps the planet when the delete fails', async () => {
      const done = planets.deletePlanet();
      failWith('/api/planet', 500, 'Internal server error');

      await expect(done).rejects.toMatchObject({ status: 500 });
      expect(identity.planetId()).toBe(mossy.id);
      expect(views.view()).toBe('planet');
    });
  });
});
