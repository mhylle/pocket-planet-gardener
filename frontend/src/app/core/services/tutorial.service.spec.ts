import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { MOSSY, plantAt } from '../../testing/garden-fixtures';
import { TUTORIAL } from '../../testing/tutorial-fixtures';
import { PlanetSnapshotDto } from '../models/planet-snapshot';
import { PlacementService } from './placement.service';
import { PlanetIdentityService } from './planet-identity.service';
import { PlanetStore } from './planet-store.service';
import { Command, SyncService } from './sync.service';
import { ROTATE_ANGLE, TUTORIAL_FINISHED, TutorialService } from './tutorial.service';

const atStep = (tutorialStep: number): PlanetSnapshotDto => ({ ...MOSSY, tutorialStep });

const PLANT: Command = {
  method: 'POST',
  path: '/garden/plants',
  body: { itemType: 'clover', lat: 0, lon: 0 },
};
const RAIN: Command = {
  method: 'POST',
  path: '/garden/rain',
  body: { cloudId: 'c1', lat: 0, lon: 0, seconds: 1 },
};
const SUN: Command = { method: 'POST', path: '/garden/sun', body: { angle: 90 } };

describe('TutorialService', () => {
  let http: HttpTestingController;
  let store: PlanetStore;
  let tutorial: TutorialService;
  let placement: PlacementService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
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
    store = TestBed.inject(PlanetStore);
    placement = TestBed.inject(PlacementService);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(SceneService).resize(800, 600);
  });

  afterEach(() => http.verify());

  /** Opens the planet at the step, starts the tutorial and serves the script. */
  function start(step: number, snapshot = atStep(step)): void {
    store.setSnapshot(snapshot);
    tutorial = TestBed.inject(TutorialService);
    http.expectOne({ method: 'GET', url: '/api/tutorial' }).flush(TUTORIAL);
    TestBed.tick();
  }

  const id = () => tutorial.current()?.id;

  /** Lets the queued save go out, checks it names the step and answers it. */
  async function expectSaved(step: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    const req = http.expectOne({ method: 'PATCH', url: '/api/planet/tutorial' });
    expect(req.request.body).toEqual({ step });
    req.flush({ tutorialStep: step });
  }

  async function expectNothingSaved(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    http.expectNone('/api/planet/tutorial');
  }

  /** Sends the command and answers it, as the game does when the player acts. */
  async function act(command: Command, answer = store.snapshot()!): Promise<void> {
    const sent = TestBed.inject(SyncService).send(command);
    http.expectOne(`/api/${command.path.slice(1)}`).flush({ snapshot: answer, events: [] });
    await sent;
  }

  /** Turns the planet by about the angle, in radians, by dragging it sideways. */
  function turn(angle: number): void {
    const camera = TestBed.inject(CameraControlsService);
    let turned = 0;
    const subscription = camera.turned.subscribe((each) => (turned += each));
    while (turned < angle) {
      camera.drag({ dx: 2, dy: 0 });
    }
    subscription.unsubscribe();
  }

  it('greets a new planet with the welcome (ONB-01 AC1)', () => {
    start(0);

    expect(tutorial.step()).toBe(0);
    expect(tutorial.current()).toEqual(TUTORIAL.steps[0]);
    expect(tutorial.finished()).toBe(false);
  });

  it('carries on from the step the planet reached (AC4)', () => {
    start(4);

    expect(id()).toBe('water');
    expect(tutorial.current()?.text).toBe(TUTORIAL.steps[4].text);
  });

  it('moves on and saves step 1 when the welcome is done', async () => {
    start(0);

    tutorial.complete('welcome');

    expect(tutorial.step()).toBe(1);
    expect(id()).toBe('rotate');
    await expectSaved(1);
  });

  it('does not move on when a later step is done early (AC2)', async () => {
    start(1);

    await act(PLANT, { ...atStep(1), plants: [plantAt('p1', 0, 0)] });
    placement.select({ itemType: 'clover', kind: 'seed' });
    TestBed.tick();
    tutorial.complete('goodbye');

    expect(id()).toBe('rotate');
    await expectNothingSaved();
  });

  it('completes the rotate step once the planet has turned far enough, and saves step 2', async () => {
    start(1);

    turn(ROTATE_ANGLE / 2);
    expect(id()).toBe('rotate');
    turn(ROTATE_ANGLE / 2);

    expect(id()).toBe('open-inventory');
    await expectSaved(2);
  });

  it('counts only the turning done while the rotate step is shown', async () => {
    start(0);
    turn(ROTATE_ANGLE * 2);

    tutorial.complete('welcome');
    await expectSaved(1);

    expect(id()).toBe('rotate');
  });

  it('completes the inventory step when an item is chosen', async () => {
    start(2);

    placement.select({ itemType: 'clover', kind: 'seed' });
    TestBed.tick();

    expect(id()).toBe('plant');
    await expectSaved(3);
  });

  it('does not count an item chosen before the inventory step began', async () => {
    start(1);
    placement.select({ itemType: 'clover', kind: 'seed' });
    TestBed.tick();
    turn(ROTATE_ANGLE);
    await expectSaved(2);

    TestBed.tick();

    expect(id()).toBe('open-inventory');
  });

  it.each([
    [3, 'planting', PLANT, 'water'],
    [4, 'raining', RAIN, 'move-sun'],
    [5, 'moving the sun', SUN, 'inspect'],
  ] as const)('completes step %i by %s', async (step, _doing, command, next) => {
    start(step);

    await act(command);

    expect(id()).toBe(next);
    await expectSaved(step + 1);
  });

  it('does not count a refused command', async () => {
    start(4);

    const sent = TestBed.inject(SyncService).send(RAIN);
    http
      .expectOne('/api/garden/rain')
      .flush({ statusCode: 400, message: 'Too dry' }, { status: 400, statusText: 'Bad Request' });
    await sent.catch(() => undefined);

    expect(id()).toBe('water');
  });

  it("completes the inspect step when a plant's card opens, not a decoration's", async () => {
    start(6);

    placement.openCard({ kind: 'decoration', id: 'd1', x: 10, y: 10 });
    TestBed.tick();
    expect(id()).toBe('inspect');
    placement.openCard({ kind: 'plant', id: 'p1', x: 10, y: 10 });
    TestBed.tick();

    expect(id()).toBe('goodbye');
    await expectSaved(7);
  });

  it('finishes after the goodbye and saves -1, so Pip waits as a help button (AC3)', async () => {
    start(7);

    tutorial.complete('goodbye');

    expect(tutorial.step()).toBe(TUTORIAL_FINISHED);
    expect(tutorial.current()).toBeNull();
    expect(tutorial.finished()).toBe(true);
    await expectSaved(TUTORIAL_FINISHED);
  });

  it('starts again from the welcome and saves 0 (ONB-03 AC2)', async () => {
    start(TUTORIAL_FINISHED);

    tutorial.restart();

    expect(id()).toBe('welcome');
    await expectSaved(0);
  });

  it('saves the steps in order, each after the one before is answered', async () => {
    start(7);

    tutorial.complete('goodbye');
    tutorial.restart();
    await new Promise((resolve) => setTimeout(resolve));
    const first = http.expectOne('/api/planet/tutorial');
    expect(first.request.body).toEqual({ step: TUTORIAL_FINISHED });
    first.flush({ tutorialStep: TUTORIAL_FINISHED });

    await expectSaved(0);
  });

  it('keeps going when a save fails', async () => {
    start(0);

    tutorial.complete('welcome');
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/planet/tutorial').error(new ProgressEvent('error'));
    turn(ROTATE_ANGLE);

    expect(id()).toBe('open-inventory');
    await expectSaved(2);
  });

  it('points at what the step is about', () => {
    start(2);

    expect(tutorial.highlight()).toBe('inventory');
  });

  it('points at the planet for a card step until a card shows', () => {
    start(6);

    expect(tutorial.highlight()).toBe('canvas');
    placement.setHoverCard({ kind: 'plant', id: 'p1', x: 10, y: 10 });
    expect(tutorial.highlight()).toBe('card');
  });

  it('shows nothing when the script cannot be loaded', () => {
    store.setSnapshot(atStep(0));
    tutorial = TestBed.inject(TutorialService);
    http
      .expectOne('/api/tutorial')
      .flush({ statusCode: 500 }, { status: 500, statusText: 'Server Error' });
    TestBed.tick();

    expect(tutorial.current()).toBeNull();
    expect(tutorial.finished()).toBe(false);
    expect(tutorial.highlight()).toBe('none');
  });
});
