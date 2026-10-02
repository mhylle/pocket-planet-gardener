import { TestBed } from '@angular/core/testing';
import { PlanetSnapshotDto } from '../models/planet-snapshot';
import { PlanetStore } from './planet-store.service';

const mossy: PlanetSnapshotDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 4,
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
  sun: { angle: 0, overrideAngle: null, overrideAt: null },
};

describe('PlanetStore', () => {
  let store: PlanetStore;

  beforeEach(() => {
    store = TestBed.inject(PlanetStore);
  });

  it('starts empty, calm and online', () => {
    expect(store.snapshot()).toBeNull();
    expect(store.version()).toBeNull();
    expect(store.pendingCommands()).toBe(0);
    expect(store.offline()).toBe(false);
    expect(store.reloadRequired()).toBe(false);
  });

  it('takes the version from the snapshot', () => {
    store.setSnapshot(mossy);
    expect(store.version()).toBe(4);

    store.setSnapshot({ ...mossy, version: 5 });
    expect(store.version()).toBe(5);
  });

  it('clear forgets the planet and its save state', () => {
    store.setSnapshot(mossy);
    store.setPendingCommands(2);
    store.setOffline(true);
    store.requireReload();

    store.clear();

    expect(store.snapshot()).toBeNull();
    expect(store.version()).toBeNull();
    expect(store.pendingCommands()).toBe(0);
    expect(store.offline()).toBe(false);
    expect(store.reloadRequired()).toBe(false);
  });
});
