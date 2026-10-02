import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogueService } from '../../core/services/catalogue.service';
import { MenuTarget, PlacementService } from '../../core/services/placement.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SceneService } from '../../scene/scene.service';
import { CATALOGUE, MOSSY, plantAt } from '../../testing/garden-fixtures';
import { ContextMenuComponent } from './context-menu.component';

describe('ContextMenuComponent', () => {
  let fixture: ComponentFixture<ContextMenuComponent>;
  let http: HttpTestingController;
  let placement: PlacementService;
  let page: HTMLElement;
  let canvas: HTMLCanvasElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ContextMenuComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PlacementService,
        ReceiptService,
        SceneService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot({
      ...MOSSY,
      plants: [plantAt('clover-1', 0, 0, { stage: 'sprout' })],
      decorations: [{ id: 'rock-1', type: 'rock', lat: 10, lon: 10 }],
    });
    TestBed.inject(SceneService).resize(800, 600);
    placement = TestBed.inject(PlacementService);
    // Stands in for the planet canvas, which has the focus when a tap opens the menu.
    canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();
    fixture = TestBed.createComponent(ContextMenuComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    canvas.remove();
    http.verify();
  });

  async function open(target: MenuTarget) {
    placement.openMenu(target);
    await fixture.whenStable();
  }
  const menu = () => page.querySelector<HTMLElement>('.menu[role="group"]');
  const button = (text: string) =>
    [...page.querySelectorAll('button')].find((each) => each.textContent!.trim() === text)!;
  const labels = () => [...page.querySelectorAll('button')].map((each) => each.textContent!.trim());

  it('offers Dig up for a plant, next to it, with the focus on it (GRD-07 AC1)', async () => {
    await open({ kind: 'plant', id: 'clover-1', x: 300, y: 200 });

    expect(menu()?.getAttribute('aria-label')).toBe('Clover (sprout)');
    expect(labels()).toEqual(['Dig up']);
    expect([menu()!.style.left, menu()!.style.top]).toEqual(['300px', '200px']);
    expect(document.activeElement).toBe(button('Dig up'));
  });

  it('digs the plant up and gives the focus back', async () => {
    await open({ kind: 'plant', id: 'clover-1', x: 300, y: 200 });

    button('Dig up').click();
    await fixture.whenStable();

    http.expectOne({ method: 'DELETE', url: '/api/garden/plants/clover-1' });
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(canvas);
  });

  it('offers Move and Put away for a decoration (ITM-02 AC2, AC3)', async () => {
    await open({ kind: 'decoration', id: 'rock-1', x: 300, y: 200 });
    expect(menu()?.getAttribute('aria-label')).toBe('Rock');
    expect(labels()).toEqual(['Move', 'Put away']);

    button('Move').click();
    await fixture.whenStable();
    expect(placement.selected()).toEqual({
      mode: 'move',
      itemType: 'rock',
      decorationId: 'rock-1',
    });
    expect(menu()).toBeNull();

    await open({ kind: 'decoration', id: 'rock-1', x: 300, y: 200 });
    button('Put away').click();
    http.expectOne({ method: 'DELETE', url: '/api/garden/decorations/rock-1' });
  });

  it('closes on Escape, giving the focus back', async () => {
    await open({ kind: 'plant', id: 'clover-1', x: 300, y: 200 });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(canvas);
  });

  it('closes on a press anywhere else, but not on itself', async () => {
    await open({ kind: 'plant', id: 'clover-1', x: 300, y: 200 });

    menu()!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(menu()).not.toBeNull();

    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(menu()).toBeNull();
  });

  it('keeps clear of the edges of the view', async () => {
    await open({ kind: 'plant', id: 'clover-1', x: 2, y: 590 });

    expect([menu()!.style.left, menu()!.style.top]).toEqual(['90px', '470px']);
  });
});
