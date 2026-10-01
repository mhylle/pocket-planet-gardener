import { TestBed } from '@angular/core/testing';
import { PlanetIdentityService } from './planet-identity.service';

describe('PlanetIdentityService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  function blockStorage(method: 'getItem' | 'setItem' | 'removeItem') {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    });
  }

  it('starts without a planet when none is stored', () => {
    expect(TestBed.inject(PlanetIdentityService).planetId()).toBeNull();
  });

  it('starts with the stored planet id', () => {
    localStorage.setItem('ppg.planetId', 'planet-1');

    expect(TestBed.inject(PlanetIdentityService).planetId()).toBe('planet-1');
  });

  it('set updates the signal and stores the id', () => {
    const identity = TestBed.inject(PlanetIdentityService);

    identity.set('planet-2');

    expect(identity.planetId()).toBe('planet-2');
    expect(localStorage.getItem('ppg.planetId')).toBe('planet-2');
  });

  it('clear empties the signal and the storage', () => {
    localStorage.setItem('ppg.planetId', 'planet-1');
    const identity = TestBed.inject(PlanetIdentityService);

    identity.clear();

    expect(identity.planetId()).toBeNull();
    expect(localStorage.getItem('ppg.planetId')).toBeNull();
  });

  it('starts without a planet when reading storage throws', () => {
    localStorage.setItem('ppg.planetId', 'planet-1');
    blockStorage('getItem');

    expect(TestBed.inject(PlanetIdentityService).planetId()).toBeNull();
  });

  it('still updates the signal when writing storage throws', () => {
    blockStorage('setItem');
    const identity = TestBed.inject(PlanetIdentityService);

    expect(() => identity.set('planet-3')).not.toThrow();
    expect(identity.planetId()).toBe('planet-3');
    expect(localStorage.getItem('ppg.planetId')).toBeNull();
  });

  it('still clears the signal when removing from storage throws', () => {
    localStorage.setItem('ppg.planetId', 'planet-1');
    blockStorage('removeItem');
    const identity = TestBed.inject(PlanetIdentityService);

    expect(() => identity.clear()).not.toThrow();
    expect(identity.planetId()).toBeNull();
    expect(localStorage.getItem('ppg.planetId')).toBe('planet-1');
  });
});
