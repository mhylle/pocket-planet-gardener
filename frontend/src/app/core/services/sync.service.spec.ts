import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { GENERIC_ERROR_MESSAGE, errorMessage } from '../helpers/error-message';
import { DEFAULT_GAME_CONFIG } from '../models/game-config';
import {
  CommandResponse,
  EventDto,
  PlanetSnapshotDto,
  WelcomeBack,
} from '../models/planet-snapshot';
import { GameConfigService } from './game-config.service';
import { PlanetIdentityService } from './planet-identity.service';
import { PlanetStore } from './planet-store.service';
import { Command, PLANET_CLOSED_MESSAGE, SyncService } from './sync.service';

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
  inventory: [{ itemType: 'clover', kind: 'seed', count: 3 }],
  unlocks: [],
  clouds: [],
  sun: { angle: 0, overrideAngle: null, overrideAt: null },
  creatures: [],
};

const atVersion = (version: number): PlanetSnapshotDto => ({ ...mossy, version });
const fulfilled: EventDto = {
  type: 'want-fulfilled',
  occurredAt: '2026-10-01T10:05:00.000Z',
  payload: { creatureId: 'mira' },
};
const answer = (snapshot: PlanetSnapshotDto): CommandResponse => ({ snapshot, events: [] });
const plant = (path = '/garden/plant'): Command => ({
  method: 'POST',
  path,
  body: { type: 'clover' },
});

describe('SyncService', () => {
  let http: HttpTestingController;
  let sync: SyncService;
  let store: PlanetStore;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    sync = TestBed.inject(SyncService);
    store = TestBed.inject(PlanetStore);
    TestBed.inject(PlanetIdentityService).set(mossy.id);
    store.setSnapshot(mossy);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const unreachable = (req: TestRequest) => req.error(new ProgressEvent('error'));
  const refuse = (req: TestRequest, status: number, message = 'Error') =>
    req.flush({ statusCode: status, message }, { status, statusText: 'Error' });
  /** Asserts nothing is sent until the full wait has passed, then returns the request. */
  function expectAfter(ms: number, url: string): TestRequest {
    vi.advanceTimersByTime(ms - 1);
    http.expectNone(url);
    vi.advanceTimersByTime(1);
    return http.expectOne(url);
  }

  describe('commands', () => {
    it('adds the current version, sends it and applies the returned snapshot', async () => {
      const saved = sync.send(plant());

      expect(store.pendingCommands()).toBe(1);
      const req = http.expectOne({ method: 'POST', url: '/api/garden/plant' });
      expect(req.request.body).toEqual({ type: 'clover', expectedVersion: 1 });
      expect(req.request.headers.get('X-Planet-Id')).toBe(mossy.id);
      const response = answer(atVersion(2));
      req.flush(response);

      await expect(saved).resolves.toEqual(response);
      expect(store.version()).toBe(2);
      expect(store.pendingCommands()).toBe(0);
    });

    it.each(['PATCH', 'DELETE'] as const)('sends %s with the body', async (method) => {
      const saved = sync.send({ method, path: '/garden/plants/p1', body: { water: 1 } });

      const req = http.expectOne({ method, url: '/api/garden/plants/p1' });
      expect(req.request.body).toEqual({ water: 1, expectedVersion: 1 });
      req.flush(answer(atVersion(2)));
      await saved;
    });

    it('passes on the item types a response names as newly unlocked (ITM-04 AC3)', async () => {
      const unlocked: string[][] = [];
      sync.newlyUnlocked.subscribe((types) => unlocked.push(types));

      const first = sync.send(plant('/first'));
      http.expectOne('/api/first').flush({ ...answer(atVersion(2)), newlyUnlocked: ['tulip'] });
      await first;
      const second = sync.send(plant('/second'));
      http.expectOne('/api/second').flush({ ...answer(atVersion(3)), newlyUnlocked: [] });
      await second;

      expect(unlocked).toEqual([['tulip']]);
    });

    it("passes on a response's events once its snapshot is stored", async () => {
      const seen: { events: EventDto[]; version: number | null }[] = [];
      sync.events.subscribe((events) => seen.push({ events, version: store.version() }));

      const first = sync.send(plant('/first'));
      http.expectOne('/api/first').flush({ snapshot: atVersion(2), events: [fulfilled] });
      await first;
      const second = sync.send(plant('/second'));
      http.expectOne('/api/second').flush(answer(atVersion(3)));
      await second;

      expect(seen).toEqual([{ events: [fulfilled], version: 2 }]);
    });

    it('sends one at a time in order, each with the version current when it goes', async () => {
      const first = sync.send(plant('/first'));
      const second = sync.send(plant('/second'));

      expect(store.pendingCommands()).toBe(2);
      const firstReq = http.expectOne('/api/first');
      http.expectNone('/api/second');
      firstReq.flush(answer(atVersion(2)));

      expect(store.pendingCommands()).toBe(1);
      const secondReq = http.expectOne('/api/second');
      expect(secondReq.request.body.expectedVersion).toBe(2);
      secondReq.flush(answer(atVersion(3)));

      await first;
      await second;
      expect(store.version()).toBe(3);
      expect(store.pendingCommands()).toBe(0);
    });
  });

  describe('when the server cannot be reached (ACC-03 AC2)', () => {
    it('keeps the command and retries after 1 s, 2 s and 4 s until it lands', async () => {
      const saved = sync.send(plant());
      unreachable(http.expectOne('/api/garden/plant'));

      expect(store.offline()).toBe(true);
      expect(store.pendingCommands()).toBe(1);
      unreachable(expectAfter(1000, '/api/garden/plant'));
      unreachable(expectAfter(2000, '/api/garden/plant'));
      const retry = expectAfter(4000, '/api/garden/plant');
      expect(retry.request.body).toEqual({ type: 'clover', expectedVersion: 1 });
      retry.flush(answer(atVersion(2)));

      await saved;
      expect(store.offline()).toBe(false);
      expect(store.pendingCommands()).toBe(0);
      expect(store.version()).toBe(2);
    });

    it('caps the wait at 30 s and starts again from 1 s after a success', async () => {
      const saved = sync.send(plant());
      unreachable(http.expectOne('/api/garden/plant'));
      for (const wait of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
        unreachable(expectAfter(wait, '/api/garden/plant'));
      }
      expectAfter(30000, '/api/garden/plant').flush(answer(atVersion(2)));
      await saved;

      const next = sync.send(plant());
      unreachable(http.expectOne('/api/garden/plant'));
      expectAfter(1000, '/api/garden/plant').flush(answer(atVersion(3)));
      await next;
    });

    it.each([502, 503, 504])('treats %i from the dev proxy as offline', async (status) => {
      const saved = sync.send(plant());
      refuse(http.expectOne('/api/garden/plant'), status);

      expect(store.offline()).toBe(true);
      expect(store.pendingCommands()).toBe(1);
      expectAfter(1000, '/api/garden/plant').flush(answer(atVersion(2)));
      await saved;
      expect(store.offline()).toBe(false);
    });

    it('holds the commands behind the one that is waiting, in order', async () => {
      const first = sync.send(plant('/first'));
      const second = sync.send(plant('/second'));
      unreachable(http.expectOne('/api/first'));

      expectAfter(1000, '/api/first').flush(answer(atVersion(2)));
      http.expectOne('/api/second').flush(answer(atVersion(3)));

      await first;
      await second;
      expect(store.version()).toBe(3);
    });
  });

  it('on a 409 asks for a reload, rejects the command and drops the queued ones', async () => {
    const first = sync.send(plant('/first')).catch((error: unknown) => error);
    const second = sync.send(plant('/second')).catch((error: unknown) => error);

    refuse(http.expectOne('/api/first'), 409, 'reload');

    expect(await first).toMatchObject({ status: 409 });
    expect(await second).toMatchObject({ status: 409 });
    http.expectNone('/api/second');
    expect(store.reloadRequired()).toBe(true);
    expect(store.pendingCommands()).toBe(0);
  });

  it.each([
    [400, 'That spot is taken', 'That spot is taken'],
    [500, 'Internal server error', GENERIC_ERROR_MESSAGE],
  ])('rejects a command refused with %i and still sends the next', async (status, sent, shown) => {
    const refused = sync.send(plant('/first')).catch((error: unknown) => error);
    const next = sync.send(plant('/second'));

    refuse(http.expectOne('/api/first'), status, sent);

    expect(errorMessage(await refused)).toBe(shown);
    const nextReq = http.expectOne('/api/second');
    expect(nextReq.request.body.expectedVersion).toBe(1);
    nextReq.flush(answer(atVersion(2)));
    await next;
    expect(store.offline()).toBe(false);
    expect(store.reloadRequired()).toBe(false);
  });

  describe('heartbeat (D-3)', () => {
    const SYNC = '/api/planet/sync';
    const later = { ...mossy, serverTime: '2026-10-01T10:00:05.000Z' };

    beforeEach(() => {
      TestBed.inject(GameConfigService).load();
      http.expectOne('/api/config').flush({ ...DEFAULT_GAME_CONFIG, syncIntervalSeconds: 5 });
    });

    afterEach(() => sync.stopHeartbeat());

    it('syncs every syncIntervalSeconds with the current version and applies the snapshot', () => {
      sync.startHeartbeat();

      const beat = expectAfter(5000, SYNC);
      expect(beat.request.method).toBe('POST');
      expect(beat.request.body).toEqual({ expectedVersion: 1 });
      beat.flush({ snapshot: later, events: [] });
      expect(store.snapshot()).toEqual(later);

      expectAfter(5000, SYNC).flush({ snapshot: later, events: [] });
    });

    it('stays quiet while commands are pending and resumes with the new version', async () => {
      sync.startHeartbeat();
      const saved = sync.send(plant());
      const command = http.expectOne('/api/garden/plant');

      vi.advanceTimersByTime(5000);
      http.expectNone(SYNC);
      command.flush(answer(atVersion(2)));
      await saved;

      expect(expectAfter(5000, SYNC).request.body).toEqual({ expectedVersion: 2 });
    });

    it('lets a command wait until a heartbeat already on its way is back', async () => {
      sync.startHeartbeat();
      const beat = expectAfter(5000, SYNC);
      const saved = sync.send(plant());

      http.expectNone('/api/garden/plant');
      beat.flush({ snapshot: mossy, events: [] });
      http.expectOne('/api/garden/plant').flush(answer(atVersion(2)));
      await saved;
    });

    it('stops on stopHeartbeat', () => {
      sync.startHeartbeat();
      sync.stopHeartbeat();

      vi.advanceTimersByTime(60_000);
      http.expectNone(SYNC);
    });

    it('does not sync before a planet is loaded', () => {
      store.clear();
      sync.startHeartbeat();

      vi.advanceTimersByTime(60_000);
      http.expectNone(SYNC);
    });

    it('on a 409 asks for a reload without throwing, then stops syncing', () => {
      sync.startHeartbeat();
      refuse(expectAfter(5000, SYNC), 409, 'reload');

      expect(store.reloadRequired()).toBe(true);
      vi.advanceTimersByTime(60_000);
      http.expectNone(SYNC);
    });

    it('shows offline while unreachable and clears it once a beat gets through', () => {
      sync.startHeartbeat();
      unreachable(expectAfter(5000, SYNC));
      expect(store.offline()).toBe(true);

      expectAfter(5000, SYNC).flush({ snapshot: mossy, events: [] });
      expect(store.offline()).toBe(false);
    });

    it('syncs at once on syncNow, and the heartbeat keeps its pace', () => {
      sync.syncNow();
      sync.startHeartbeat();

      const now = http.expectOne(SYNC);
      expect(now.request.body).toEqual({ expectedVersion: 1 });
      now.flush({ snapshot: later, events: [] });
      expect(store.snapshot()).toEqual(later);

      expectAfter(5000, SYNC).flush({ snapshot: later, events: [] });
    });

    it('keeps the welcome-back summary from a sync until a newer one comes (TIM-03)', () => {
      const first: WelcomeBack = {
        summary: [{ kind: 'blooms', count: 1, text: '1 plant bloomed' }],
      };
      const second: WelcomeBack = {
        summary: [{ kind: 'creatures', count: 1, text: '1 new creature' }],
      };
      sync.startHeartbeat();
      expect(store.welcomeBack()).toBeNull();

      expectAfter(5000, SYNC).flush({ snapshot: mossy, events: [], welcomeBack: first });
      expect(store.welcomeBack()).toEqual(first);

      expectAfter(5000, SYNC).flush({ snapshot: mossy, events: [] });
      expect(store.welcomeBack()).toEqual(first);

      expectAfter(5000, SYNC).flush({ snapshot: mossy, events: [], welcomeBack: second });
      expect(store.welcomeBack()).toEqual(second);
    });

    it('passes on what a sync names as newly unlocked and what happened (ITM-04 AC3)', () => {
      const unlocked: string[][] = [];
      const happened: EventDto[][] = [];
      sync.newlyUnlocked.subscribe((types) => unlocked.push(types));
      sync.events.subscribe((events) => happened.push(events));

      sync.syncNow();
      http
        .expectOne(SYNC)
        .flush({ snapshot: mossy, events: [fulfilled], newlyUnlocked: ['tulip'] });
      sync.syncNow();
      http.expectOne(SYNC).flush({ snapshot: mossy, events: [] });

      expect(unlocked).toEqual([['tulip']]);
      expect(happened).toEqual([[fulfilled]]);
    });
  });

  describe('reset', () => {
    it('cancels the request in flight and rejects every queued command', async () => {
      const first = sync.send(plant('/first')).catch((error: unknown) => error);
      const second = sync.send(plant('/second')).catch((error: unknown) => error);
      const inFlight = http.expectOne('/api/first');

      sync.reset();

      expect(inFlight.cancelled).toBe(true);
      expect(await first).toMatchObject({ message: PLANET_CLOSED_MESSAGE });
      expect(await second).toMatchObject({ message: PLANET_CLOSED_MESSAGE });
      expect(store.pendingCommands()).toBe(0);
      vi.advanceTimersByTime(60_000);
      http.expectNone('/api/second');
    });

    it('stops waiting to retry and stops the heartbeat', async () => {
      sync.startHeartbeat();
      const unsaved = sync.send(plant()).catch((error: unknown) => error);
      unreachable(http.expectOne('/api/garden/plant'));

      sync.reset();

      await unsaved;
      vi.advanceTimersByTime(60_000);
      http.expectNone('/api/garden/plant');
      http.expectNone('/api/planet/sync');
    });
  });
});
