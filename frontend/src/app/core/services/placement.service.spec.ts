import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CATALOGUE, CLOVER_WANT, MOSSY, creatureAt, plantAt } from '../../testing/garden-fixtures';
import { PLANT_FOOTPRINT_STEPS, PlacementState, canPlaceAt } from '../helpers/placement-rules';
import { SurfacePoint } from '../helpers/surface-coords';
import { WantSpec } from '../helpers/want-evaluator';
import { PlanetSnapshotDto } from '../models/planet-snapshot';
import { WantDto } from '../models/want';
import { CatalogueService } from './catalogue.service';
import { PlacementService } from './placement.service';
import { PlanetIdentityService } from './planet-identity.service';
import { PlanetStore } from './planet-store.service';

const clover = { itemType: 'clover', kind: 'seed' } as const;
const pond = { itemType: 'pond', kind: 'decoration' } as const;
const refusal = (message: string, reason: string) =>
  [
    { statusCode: 400, message, reason },
    { status: 400, statusText: 'Bad Request' },
  ] as const;

describe('PlacementService', () => {
  let http: HttpTestingController;
  let store: PlanetStore;
  let placement: PlacementService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PlacementService],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(PlanetStore);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    store.setSnapshot(MOSSY);
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    placement = TestBed.inject(PlacementService);
  });

  afterEach(() => http.verify());

  const respond = (snapshot: PlanetSnapshotDto) => ({ snapshot, events: [], newlyUnlocked: [] });
  const withPlanet = (changes: Partial<PlanetSnapshotDto>) =>
    store.setSnapshot({ ...MOSSY, ...changes });

  describe('preview', () => {
    /** The planet as the rules read it, written out by hand. */
    const stateOf = (snapshot: PlanetSnapshotDto): PlacementState => ({
      plants: snapshot.plants.map(({ id, lat, lon }) => ({ id, lat, lon })),
      decorations: snapshot.decorations.map(({ id, lat, lon, type }) => ({
        id,
        lat,
        lon,
        footprintSteps: type === 'pond' ? 3 : 1,
        isWater: type === 'pond',
      })),
      maxPlants: snapshot.maxPlants,
    });
    const seedAt = (point: SurfacePoint) =>
      canPlaceAt(stateOf(store.snapshot()!), {
        kind: 'plant',
        point,
        footprintSteps: PLANT_FOOTPRINT_STEPS,
      });

    it('shows nothing without a selection or a point', () => {
      placement.setHover({ lat: 10, lon: 10 });
      expect(placement.preview()).toBeNull();

      placement.select(clover);
      placement.setHover(null);
      expect(placement.preview()).toBeNull();
    });

    it('allows a free spot (GRD-01 AC2)', () => {
      const point = { lat: 30, lon: 30 };
      placement.select(clover);
      placement.setHover(point);

      expect(placement.preview()).toBe('ok');
      expect(placement.preview()).toBe(seedAt(point));
    });

    it('refuses a spot next to a plant (GRD-01 AC3)', () => {
      const point = { lat: 30, lon: 33 };
      withPlanet({ plants: [plantAt('plant-1', 30, 30)] });
      placement.select(clover);
      placement.setHover(point);

      expect(placement.preview()).toBe('occupied-plant');
      expect(placement.preview()).toBe(seedAt(point));
    });

    it('refuses water, using the footprint from the catalogue', () => {
      const point = { lat: -20, lon: 16 };
      withPlanet({ decorations: [{ id: 'pond-1', type: 'pond', lat: -20, lon: 10 }] });
      placement.select(clover);
      placement.setHover(point);

      expect(placement.preview()).toBe('occupied-water');
      expect(placement.preview()).toBe(seedAt(point));
    });

    it('refuses any spot once the planet is full (GRD-01 AC4)', () => {
      const point = { lat: 50, lon: -60 };
      withPlanet({ maxPlants: 1, plants: [plantAt('plant-1', -30, 100)] });
      placement.select(clover);
      placement.setHover(point);

      expect(placement.preview()).toBe('planet-full');
      expect(placement.preview()).toBe(seedAt(point));
    });

    it('measures a decoration by its own footprint', () => {
      withPlanet({ plants: [plantAt('plant-1', 0, 0)] });
      placement.select(pond);

      expect(placement.footprintSteps()).toBe(3);
      placement.setHover({ lat: 0, lon: 9 });
      expect(placement.preview()).toBe('occupied-plant');
      placement.setHover({ lat: 0, lon: 11 });
      expect(placement.preview()).toBe('ok');
    });
  });

  describe('selection', () => {
    it('toggles an item, closing any card and clearing an old message', () => {
      placement.openCard({ kind: 'plant', id: 'plant-1', x: 10, y: 10 });

      placement.select(clover);
      expect(placement.selected()).toEqual({ mode: 'place', itemType: 'clover', kind: 'seed' });
      expect(placement.card()).toBeNull();

      placement.select(clover);
      expect(placement.selected()).toBeNull();

      placement.select(pond);
      placement.cancel();
      expect(placement.selected()).toBeNull();
    });
  });

  describe('placing', () => {
    it('plants at the tapped point and keeps the seed selected while there are more (GRD-01 AC1)', async () => {
      placement.select(clover);

      const planted = placement.placeAt({ lat: 12.5, lon: -40 });
      const request = http.expectOne({ method: 'POST', url: '/api/garden/plants' });
      expect(request.request.body).toEqual({
        itemType: 'clover',
        lat: 12.5,
        lon: -40,
        expectedVersion: 1,
      });
      request.flush(
        respond({
          ...MOSSY,
          version: 2,
          plants: [plantAt('plant-1', 12.5, -40)],
          inventory: [{ itemType: 'clover', kind: 'seed', count: 2 }],
        }),
      );
      await planted;

      expect(placement.selected()?.itemType).toBe('clover');
      expect(store.snapshot()?.plants).toHaveLength(1);
    });

    it('stops placing once the last one is used', async () => {
      placement.select(clover);

      const planted = placement.placeAt({ lat: 1, lon: 2 });
      http.expectOne('/api/garden/plants').flush(respond({ ...MOSSY, version: 2, inventory: [] }));
      await planted;

      expect(placement.selected()).toBeNull();
    });

    it('places a decoration with its own command (ITM-02 AC1)', async () => {
      placement.select(pond);

      const placed = placement.placeAt({ lat: -5, lon: 170 });
      const request = http.expectOne({ method: 'POST', url: '/api/garden/decorations' });
      expect(request.request.body).toEqual({
        itemType: 'pond',
        lat: -5,
        lon: 170,
        expectedVersion: 1,
      });
      request.flush(respond({ ...MOSSY, version: 2, inventory: [] }));
      await placed;

      expect(placement.selected()).toBeNull();
    });

    it("shows the server's reason, keeps the selection and puts the preview back", async () => {
      placement.select(clover);
      placement.setHover({ lat: 10, lon: 10 });

      const planted = placement.placeAt({ lat: 20, lon: 20 });
      expect(placement.previewPoint()).toEqual({ lat: 20, lon: 20 });
      expect(placement.saving()).toBe(true);
      http
        .expectOne('/api/garden/plants')
        .flush(...refusal('Something is already growing there.', 'occupied-plant'));
      await planted;

      expect(placement.message()).toBe('Something is already growing there.');
      expect(placement.selected()?.itemType).toBe('clover');
      expect(placement.saving()).toBe(false);
      expect(placement.previewPoint()).toEqual({ lat: 10, lon: 10 });
      expect(placement.preview()).toBe('ok');
      expect(store.snapshot()).toEqual(MOSSY);
    });

    it('ignores a second tap while the first is being saved', async () => {
      placement.select(clover);

      const first = placement.placeAt({ lat: 1, lon: 1 });
      void placement.placeAt({ lat: 40, lon: 40 });
      http.expectOne('/api/garden/plants').flush(respond({ ...MOSSY, version: 2 }));
      await first;

      http.expectNone('/api/garden/plants');
    });

    it('does nothing without a selection', async () => {
      await placement.placeAt({ lat: 1, lon: 1 });

      http.expectNone('/api/garden/plants');
    });
  });

  describe('removing and moving', () => {
    const rock = { id: 'rock-1', type: 'rock', lat: 0, lon: 0 };

    it('digs up a plant with DELETE /garden/plants/:id (GRD-07 AC1)', async () => {
      withPlanet({ plants: [plantAt('plant-1', 3, 4)] });
      placement.openCard({ kind: 'plant', id: 'plant-1', x: 1, y: 2 });

      const dug = placement.digUp('plant-1');
      const request = http.expectOne({ method: 'DELETE', url: '/api/garden/plants/plant-1' });
      expect(request.request.body).toEqual({ expectedVersion: 1 });
      request.flush(respond({ ...MOSSY, version: 2 }));
      await dug;

      expect(placement.card()).toBeNull();
      expect(store.snapshot()?.plants).toEqual([]);
    });

    it('puts a decoration away with DELETE /garden/decorations/:id (ITM-02 AC3)', async () => {
      withPlanet({ decorations: [rock] });

      const putAway = placement.putAway('rock-1');
      const request = http.expectOne({ method: 'DELETE', url: '/api/garden/decorations/rock-1' });
      expect(request.request.body).toEqual({ expectedVersion: 1 });
      request.flush(respond({ ...MOSSY, version: 2 }));
      await putAway;
    });

    it('moves a decoration with PATCH to the new point, ignoring its old spot (ITM-02 AC2)', async () => {
      withPlanet({ decorations: [rock] });
      placement.startMove('rock-1');

      expect(placement.selected()).toEqual({
        mode: 'move',
        itemType: 'rock',
        decorationId: 'rock-1',
      });
      placement.setHover({ lat: 0, lon: 0.5 });
      expect(placement.preview()).toBe('ok');

      const moved = placement.placeAt({ lat: 5, lon: 6 });
      const request = http.expectOne({
        method: 'PATCH',
        url: '/api/garden/decorations/rock-1/position',
      });
      expect(request.request.body).toEqual({ lat: 5, lon: 6, expectedVersion: 1 });
      request.flush(respond({ ...MOSSY, version: 2, decorations: [{ ...rock, lat: 5, lon: 6 }] }));
      await moved;

      expect(placement.selected()).toBeNull();
    });

    it('ends a move when the decoration is gone', async () => {
      withPlanet({ decorations: [rock] });
      placement.startMove('rock-1');

      const moved = placement.placeAt({ lat: 5, lon: 6 });
      http
        .expectOne('/api/garden/decorations/rock-1/position')
        .flush(
          { message: 'That decoration is not here any more.' },
          { status: 404, statusText: 'Not Found' },
        );
      await moved;

      expect(placement.message()).toBe('That decoration is not here any more.');
      expect(placement.selected()).toBeNull();
    });

    it('leaves a conflict to the reload banner', async () => {
      const dug = placement.digUp('plant-1');
      http
        .expectOne('/api/garden/plants/plant-1')
        .flush({ message: 'reload' }, { status: 409, statusText: 'Conflict' });
      await dug;

      expect(placement.message()).toBeNull();
      expect(store.reloadRequired()).toBe(true);
    });
  });

  describe('harvesting', () => {
    const bloom = plantAt('plant-1', 3, 4, { stage: 'bloom', growth: 1, harvestReady: true });

    it('collects the seeds of a ready bloom with POST /garden/plants/:id/harvest (GRD-08 AC2)', async () => {
      withPlanet({ plants: [bloom] });
      placement.openCard({ kind: 'plant', id: 'plant-1', x: 1, y: 2 });

      const harvested = placement.harvest('plant-1');
      const request = http.expectOne({ method: 'POST', url: '/api/garden/plants/plant-1/harvest' });
      expect(request.request.body).toEqual({ expectedVersion: 1 });
      request.flush(
        respond({
          ...MOSSY,
          version: 2,
          plants: [{ ...bloom, harvestReady: false }],
          inventory: [{ itemType: 'clover', kind: 'seed', count: 5 }],
        }),
      );
      await harvested;

      expect(placement.card()).toBeNull();
      expect(store.snapshot()?.plants[0].stage).toBe('bloom');
    });

    it("shows the server's line when it is too soon (GRD-08 AC3)", async () => {
      withPlanet({ plants: [bloom] });

      const harvested = placement.harvest('plant-1');
      http
        .expectOne('/api/garden/plants/plant-1/harvest')
        .flush(...refusal('These seeds need a little longer.', 'cooldown'));
      await harvested;

      expect(placement.message()).toBe('These seeds need a little longer.');
    });
  });

  describe('hover card', () => {
    const over = (id: string, x = 5) => ({ kind: 'plant' as const, id, x, y: 5 });

    it('follows the pointer and closes when it moves away (NAV-03 AC3)', () => {
      placement.setHoverCard(over('plant-1'));
      expect(placement.hoverCard()).toEqual(over('plant-1'));

      placement.setHoverCard(null);
      expect(placement.hoverCard()).toBeNull();
    });

    it('stays closed after Escape until the pointer moves on to something else', () => {
      placement.setHoverCard(over('plant-1'));
      placement.dismissHoverCard();

      placement.setHoverCard(over('plant-1', 6));
      expect(placement.hoverCard()).toBeNull();

      placement.setHoverCard(over('plant-2'));
      expect(placement.hoverCard()?.id).toBe('plant-2');
      placement.setHoverCard(over('plant-1'));
      expect(placement.hoverCard()?.id).toBe('plant-1');
    });
  });

  describe('who would notice a plant going (GRD-07 AC3)', () => {
    /** Mira's home is at 30, 30; Sam has no want. */
    const mira = (want: WantDto) => creatureAt('mira', 30, 30, { want });
    const sam = creatureAt('sam', 0, 0, { name: 'Sam', species: 'snail' });
    const near = (spec: WantSpec): WantDto => ({ ...CLOVER_WANT, spec });

    beforeEach(() =>
      withPlanet({
        plants: [plantAt('by-pond', 0, 1), plantAt('far', -40, -40), plantAt('at-home', 30, 31)],
        decorations: [{ id: 'pond-1', type: 'pond', lat: 0, lon: 0 }],
      }),
    );
    const noticing = (plantId: string) => placement.noticedBy(plantId).map(({ id }) => id);

    it("names the creatures whose want needs the plant, by the want's own rules", () => {
      withPlanet({ ...store.snapshot()!, creatures: [mira(CLOVER_WANT), sam] });

      expect(noticing('by-pond')).toEqual(['mira']);
      expect(noticing('far')).toEqual([]);
    });

    it("measures a want near home from the creature's home", () => {
      const variety = near({ type: 'variety', distinct: 2, withinSteps: 1 });
      withPlanet({ ...store.snapshot()!, creatures: [mira(variety)] });

      expect(noticing('at-home')).toEqual(['mira']);
      expect(noticing('by-pond')).toEqual([]);
    });

    it('names nobody for a plant that is not there, or with no wants', () => {
      withPlanet({ ...store.snapshot()!, creatures: [sam] });

      expect(noticing('by-pond')).toEqual([]);
      expect(noticing('gone')).toEqual([]);
    });
  });
});
