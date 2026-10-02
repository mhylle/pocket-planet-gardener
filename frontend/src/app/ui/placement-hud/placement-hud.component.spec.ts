import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SurfacePoint } from '../../core/helpers/surface-coords';
import { PlanetSnapshotDto } from '../../core/models/planet-snapshot';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CATALOGUE, MOSSY, plantAt } from '../../testing/garden-fixtures';
import { PlacementHudComponent } from './placement-hud.component';

describe('PlacementHudComponent', () => {
  let fixture: ComponentFixture<PlacementHudComponent>;
  let http: HttpTestingController;
  let store: PlanetStore;
  let placement: PlacementService;
  let hud: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PlacementHudComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), PlacementService],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    store = TestBed.inject(PlanetStore);
    store.setSnapshot({
      ...MOSSY,
      plants: [plantAt('clover-1', 0, 0)],
      decorations: [{ id: 'pond-1', type: 'pond', lat: 0, lon: 60 }],
    });
    placement = TestBed.inject(PlacementService);
    fixture = TestBed.createComponent(PlacementHudComponent);
    hud = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  async function hoverWith(point: SurfacePoint, changes: Partial<PlanetSnapshotDto> = {}) {
    store.setSnapshot({ ...store.snapshot()!, ...changes });
    placement.setHover(point);
    await fixture.whenStable();
  }
  const status = () => hud.querySelector('.status[role="status"]')!;
  const message = () => hud.querySelector('.message[aria-live="polite"]')!;

  it('shows nothing but an empty live region without a selection', () => {
    expect(hud.querySelector('.hud')).toBeNull();
    expect(message().textContent!.trim()).toBe('');
  });

  it('names what is being placed and says, with an icon, whether the spot is free (SET-04)', async () => {
    placement.select({ itemType: 'clover', kind: 'seed' });
    const icons = new Set<string>();
    const cases: [SurfacePoint, Partial<PlanetSnapshotDto>, string][] = [
      [{ lat: 40, lon: -40 }, {}, 'Free spot'],
      [{ lat: 0, lon: 2 }, {}, 'Something is already there'],
      [{ lat: 0, lon: 62 }, {}, "That's water"],
      [{ lat: 40, lon: -40 }, { maxPlants: 1 }, 'Planet is full'],
    ];

    for (const [point, changes, text] of cases) {
      await hoverWith(point, changes);

      expect(hud.querySelector('.doing')?.textContent).toBe('Planting: Clover seed');
      expect(status().textContent!.trim()).toBe(text);
      icons.add(status().querySelector('svg[aria-hidden="true"]')!.innerHTML);
    }
    expect(icons.size).toBe(4);
  });

  it('names a decoration being placed or moved', async () => {
    placement.select({ itemType: 'pond', kind: 'decoration' });
    await fixture.whenStable();
    expect(hud.querySelector('.doing')?.textContent).toBe('Placing: Pond');

    placement.startMove('pond-1');
    await fixture.whenStable();
    expect(hud.querySelector('.doing')?.textContent).toBe('Moving: Pond');
  });

  it("announces the server's reason when it refuses, keeping the selection", async () => {
    placement.select({ itemType: 'clover', kind: 'seed' });
    const planted = placement.placeAt({ lat: 30, lon: 30 });
    http
      .expectOne('/api/garden/plants')
      .flush(
        { message: 'A little too close to another plant.', reason: 'occupied-plant' },
        { status: 400, statusText: 'Bad Request' },
      );
    await planted;
    await fixture.whenStable();

    expect(message().textContent!.trim()).toBe('A little too close to another plant.');
    expect(hud.querySelector('.hud')).not.toBeNull();
  });

  it('stops placing from its button', async () => {
    placement.select({ itemType: 'clover', kind: 'seed' });
    await fixture.whenStable();

    hud.querySelector<HTMLButtonElement>('.hud button')!.click();
    await fixture.whenStable();

    expect(placement.selected()).toBeNull();
    expect(hud.querySelector('.hud')).toBeNull();
  });
});
