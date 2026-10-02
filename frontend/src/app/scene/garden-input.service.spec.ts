import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogueService } from '../core/services/catalogue.service';
import { PlacementService } from '../core/services/placement.service';
import { PlanetIdentityService } from '../core/services/planet-identity.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { CATALOGUE, MOSSY, plantAt } from '../testing/garden-fixtures';
import { GardenInputService } from './garden-input.service';
import { InputService } from './input.service';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { PlanetMeshService } from './planet-mesh.service';
import { PlantMeshService } from './plant-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SCENE_PROVIDERS } from './scene.providers';
import { SceneService } from './scene.service';

const clover = { itemType: 'clover', kind: 'seed' } as const;

describe('GardenInputService', () => {
  let http: HttpTestingController;
  let placement: PlacementService;
  let picking: PickingService;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        PlacementService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot({ ...MOSSY, plants: [plantAt('clover-1', 0, 0)] });
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(SceneService).resize(800, 600);
    TestBed.inject(PlanetMeshService);
    TestBed.inject(PlantMeshService);
    TestBed.inject(GardenInputService);
    placement = TestBed.inject(PlacementService);
    picking = TestBed.inject(PickingService);
    canvas = document.createElement('canvas');
    // jsdom has no pointer capture.
    canvas.setPointerCapture = vi.fn();
    document.body.append(canvas);
    TestBed.inject(InputService).connect(canvas);
    TestBed.tick();
  });

  afterEach(() => {
    canvas.remove();
    http.verify();
  });

  const pointer = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y }),
    );
  const tap = (x: number, y: number) => {
    pointer('pointerdown', x, y);
    pointer('pointerup', x, y);
  };
  const key = (type: 'keydown' | 'keyup', code: string, value: string) =>
    canvas.dispatchEvent(new KeyboardEvent(type, { code, key: value }));
  const select = () => {
    placement.select(clover);
    TestBed.tick();
  };
  const surfaceAt = (x: number, y: number) => picking.pick({ x, y })!.surface!;

  it('previews at the middle of the view until the mouse is over the canvas, then follows it', () => {
    expect(placement.hover()).toBeNull();
    select();
    expect(placement.hover()?.lat).toBeCloseTo(0, 6);
    expect(placement.hover()?.lon).toBeCloseTo(0, 6);

    pointer('pointermove', 520, 240);
    expect(placement.hover()).toEqual(surfaceAt(520, 240));

    canvas.dispatchEvent(new PointerEvent('pointerleave'));
    expect(placement.hover()?.lon).toBeCloseTo(0, 6);

    placement.cancel();
    TestBed.tick();
    expect(placement.hover()).toBeNull();
  });

  it('plants at the tapped spot (GRD-01 AC1)', () => {
    select();
    const spot = surfaceAt(560, 200);

    tap(560, 200);

    const request = http.expectOne({ method: 'POST', url: '/api/garden/plants' });
    expect(request.request.body).toEqual({
      itemType: 'clover',
      lat: spot.lat,
      lon: spot.lon,
      expectedVersion: 1,
    });
  });

  it('places nothing for a tap on the open sky', () => {
    select();

    tap(3, 3);

    http.expectNone('/api/garden/plants');
  });

  it('places at the middle of the view on Enter, once per press (SET-05)', () => {
    select();

    key('keydown', 'Enter', 'Enter');
    key('keydown', 'Enter', 'Enter');
    key('keyup', 'Enter', 'Enter');

    const request = http.expectOne({ method: 'POST', url: '/api/garden/plants' });
    expect(request.request.body.lat).toBeCloseTo(0, 6);
    expect(request.request.body.lon).toBeCloseTo(0, 6);
  });

  it('pins the card of a tapped plant, and closes it on open ground or a drag', () => {
    tap(400, 300);
    expect(placement.card()).toEqual({ kind: 'plant', id: 'clover-1', x: 400, y: 300 });

    tap(500, 350);
    expect(placement.card()).toBeNull();

    key('keydown', 'Enter', 'Enter');
    expect(placement.card()?.id).toBe('clover-1');
    pointer('pointerdown', 100, 100);
    pointer('pointermove', 150, 100);
    expect(placement.card()).toBeNull();
  });

  it('shows the card of the plant under the mouse, and closes it on moving away (NAV-03)', () => {
    pointer('pointermove', 400, 300);
    expect(placement.hoverCard()).toEqual({ kind: 'plant', id: 'clover-1', x: 400, y: 300 });

    pointer('pointermove', 500, 350);
    expect(placement.hoverCard()).toBeNull();

    pointer('pointermove', 400, 300);
    canvas.dispatchEvent(new PointerEvent('pointerleave'));
    expect(placement.hoverCard()).toBeNull();
  });

  it('shows no hover card while placing, turning the planet or with a card pinned', () => {
    select();
    pointer('pointermove', 400, 300);
    expect(placement.hoverCard()).toBeNull();
    placement.cancel();
    TestBed.tick();

    pointer('pointerdown', 100, 100);
    pointer('pointermove', 400, 300);
    expect(placement.hoverCard()).toBeNull();
    pointer('pointerup', 400, 300);
    expect(placement.hoverCard()?.id).toBe('clover-1');

    tap(400, 300);
    pointer('pointermove', 401, 300);
    expect(placement.hoverCard()).toBeNull();
  });

  describe('a bloom with seeds ready (GRD-08 AC2)', () => {
    beforeEach(() => {
      TestBed.inject(PlanetStore).setSnapshot({
        ...MOSSY,
        plants: [plantAt('clover-1', 0, 0, { stage: 'bloom', growth: 1, harvestReady: true })],
      });
      TestBed.tick();
    });

    it('collects the seeds on a tap', () => {
      tap(400, 300);

      http.expectOne({ method: 'POST', url: '/api/garden/plants/clover-1/harvest' });
      expect(placement.card()).toBeNull();
    });

    it('pins the card on Enter, which offers to collect them', () => {
      key('keydown', 'Enter', 'Enter');

      http.expectNone('/api/garden/plants/clover-1/harvest');
      expect(placement.card()?.id).toBe('clover-1');
    });
  });

  it('pins the card of a bloom without seeds ready instead of collecting', () => {
    TestBed.inject(PlanetStore).setSnapshot({
      ...MOSSY,
      plants: [plantAt('clover-1', 0, 0, { stage: 'bloom', growth: 1, harvestReady: false })],
    });
    TestBed.tick();

    tap(400, 300);

    http.expectNone('/api/garden/plants/clover-1/harvest');
    expect(placement.card()?.id).toBe('clover-1');
  });

  it('stops placing on Escape', () => {
    select();

    key('keydown', 'Escape', 'Escape');

    expect(placement.selected()).toBeNull();
  });
});
