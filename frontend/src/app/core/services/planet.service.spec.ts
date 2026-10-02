import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlanetDto } from '../models/planet';
import { PlanetSnapshotDto } from '../models/planet-snapshot';
import { DRIFTED_AWAY_NOTICE, PlanetService } from './planet.service';
import { PlanetIdentityService } from './planet-identity.service';
import { PlanetStore } from './planet-store.service';
import { PLANET_CLOSED_MESSAGE, SyncService } from './sync.service';
import { ViewStateService } from './view-state.service';

const mossy: PlanetDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
};

const mossySnapshot: PlanetSnapshotDto = {
  ...mossy,
  radiusLevel: 1,
  maxPlants: 60,
  tutorialStep: 0,
  serverTime: '2026-10-01T10:00:00.000Z',
  plants: [],
  decorations: [],
  inventory: [{ itemType: 'clover', kind: 'seed', count: 3 }],
  unlocks: [],
  clouds: [],
  sun: { angle: 0, overrideAngle: null, overrideAt: null },
};

describe('PlanetService', () => {
  let http: HttpTestingController;
  let planets: PlanetService;
  let identity: PlanetIdentityService;
  let views: ViewStateService;
  let store: PlanetStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    planets = TestBed.inject(PlanetService);
    identity = TestBed.inject(PlanetIdentityService);
    views = TestBed.inject(ViewStateService);
    store = TestBed.inject(PlanetStore);
  });

  afterEach(() => http.verify());

  function failWith(url: string, status: number, message: string | string[]) {
    http
      .expectOne(url)
      .flush({ statusCode: status, message, error: 'Error' }, { status, statusText: 'Error' });
  }

  describe('create', () => {
    it('posts the trimmed name, stores the id and shows the planet page to load it', async () => {
      store.setSnapshot({ ...mossySnapshot, id: 'an-earlier-planet' });
      const done = planets.create('  Mossy  ');

      const req = http.expectOne({ method: 'POST', url: '/api/planet' });
      expect(req.request.body).toEqual({ name: 'Mossy' });
      req.flush(mossy);
      await done;

      expect(identity.planetId()).toBe(mossy.id);
      expect(localStorage.getItem('ppg.planetId')).toBe(mossy.id);
      expect(store.snapshot()).toBeNull();
      expect(views.view()).toBe('planet');
    });

    it('rejects and changes nothing when the server refuses the name', async () => {
      const done = planets.create('Bad');
      failWith('/api/planet', 400, 'Let us pick a kinder name');

      await expect(done).rejects.toMatchObject({ status: 400 });
      expect(identity.planetId()).toBeNull();
      expect(store.snapshot()).toBeNull();
      expect(views.view()).toBe('create-planet');
    });
  });

  describe('load', () => {
    beforeEach(() => identity.set(mossy.id));

    it('fetches the stored planet with its id in the header into the store', async () => {
      const done = planets.load();

      const req = http.expectOne({ method: 'GET', url: '/api/planet' });
      expect(req.request.headers.get('X-Planet-Id')).toBe(mossy.id);
      req.flush(mossySnapshot);
      await done;

      expect(store.snapshot()).toEqual(mossySnapshot);
      expect(store.version()).toBe(1);
    });

    it.each([404, 400])('forgets the id and shows create-planet on %i', async (status) => {
      views.show('planet');
      const done = planets.load();
      failWith('/api/planet', status, 'This planet has drifted away');
      await done;

      expect(identity.planetId()).toBeNull();
      expect(localStorage.getItem('ppg.planetId')).toBeNull();
      expect(store.snapshot()).toBeNull();
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

  it('rename patches the trimmed name and keeps the rest of the snapshot', async () => {
    identity.set(mossy.id);
    store.setSnapshot(mossySnapshot);
    const done = planets.rename(' Fernhill ');

    const req = http.expectOne({ method: 'PATCH', url: '/api/planet/name' });
    expect(req.request.body).toEqual({ name: 'Fernhill' });
    req.flush({ ...mossy, name: 'Fernhill' });
    await done;

    expect(store.snapshot()).toEqual({ ...mossySnapshot, name: 'Fernhill' });
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
    store.setSnapshot(mossySnapshot);
    views.show('planet');

    planets.leave();

    expect(localStorage.getItem('ppg.planetId')).toBeNull();
    expect(store.snapshot()).toBeNull();
    expect(planets.notice()).toBeNull();
    expect(views.view()).toBe('create-planet');
  });

  it('drops unsaved commands when the planet closes, so they never reach another one', async () => {
    identity.set(mossy.id);
    store.setSnapshot(mossySnapshot);
    const unsaved = TestBed.inject(SyncService)
      .send({ method: 'POST', path: '/garden/plant', body: { type: 'clover' } })
      .catch((error: unknown) => error);
    http.expectOne('/api/garden/plant').error(new ProgressEvent('error'));
    expect(store.offline()).toBe(true);

    planets.leave();

    expect(await unsaved).toMatchObject({ message: PLANET_CLOSED_MESSAGE });
    expect(store.pendingCommands()).toBe(0);
    expect(store.offline()).toBe(false);
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
