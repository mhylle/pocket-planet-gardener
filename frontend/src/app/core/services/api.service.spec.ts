import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { PlanetIdentityService } from './planet-identity.service';

describe('ApiService', () => {
  let http: HttpTestingController;
  let api: ApiService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApiService);
  });

  afterEach(() => http.verify());

  /** Fires one request per method and returns them in that order. */
  function sendOneOfEach() {
    api.get('/config').subscribe();
    api.post('/planet', { name: 'Mossy' }).subscribe();
    api.patch('/planet/sun', { angle: 90 }).subscribe();
    api.delete('/planet', { confirm: true }).subscribe();
    return http.match(() => true);
  }

  it('prefixes /api and passes method and body through', () => {
    const requests = sendOneOfEach();

    expect(requests.map((r) => [r.request.method, r.request.url, r.request.body])).toEqual([
      ['GET', '/api/config', null],
      ['POST', '/api/planet', { name: 'Mossy' }],
      ['PATCH', '/api/planet/sun', { angle: 90 }],
      ['DELETE', '/api/planet', { confirm: true }],
    ]);
    requests.forEach((r) => r.flush({}));
  });

  it('sends a delete without a body when none is given', () => {
    api.delete('/planet/plants/7').subscribe();

    const req = http.expectOne({ method: 'DELETE', url: '/api/planet/plants/7' });
    expect(req.request.body).toBeNull();
    req.flush({});
  });

  it('carries X-Planet-Id on every request once a planet id is set', () => {
    TestBed.inject(PlanetIdentityService).set('planet-123');

    const requests = sendOneOfEach();

    expect(requests).toHaveLength(4);
    requests.forEach((r) => {
      expect(r.request.headers.get('X-Planet-Id')).toBe('planet-123');
      r.flush({});
    });
  });

  it('omits X-Planet-Id when no planet id is known', () => {
    const requests = sendOneOfEach();

    expect(requests).toHaveLength(4);
    requests.forEach((r) => {
      expect(r.request.headers.has('X-Planet-Id')).toBe(false);
      r.flush({});
    });
  });

  it('stops sending X-Planet-Id after the planet id is cleared', () => {
    const identity = TestBed.inject(PlanetIdentityService);
    identity.set('planet-123');
    identity.clear();

    api.get('/config').subscribe();

    const req = http.expectOne('/api/config');
    expect(req.request.headers.has('X-Planet-Id')).toBe(false);
    req.flush({});
  });
});
