import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InventoryItemDto } from '../../core/models/planet-snapshot';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CATALOGUE, MOSSY } from '../../testing/garden-fixtures';
import { InventoryPanelComponent } from './inventory-panel.component';

describe('InventoryPanelComponent', () => {
  let fixture: ComponentFixture<InventoryPanelComponent>;
  let store: PlanetStore;
  let placement: PlacementService;
  let panel: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [InventoryPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), PlacementService],
    });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    store = TestBed.inject(PlanetStore);
    placement = TestBed.inject(PlacementService);
    owning([
      { itemType: 'clover', kind: 'seed', count: 3 },
      { itemType: 'sunflower', kind: 'seed', count: 0 },
      { itemType: 'pond', kind: 'decoration', count: 1 },
    ]);
    fixture = TestBed.createComponent(InventoryPanelComponent);
    panel = fixture.nativeElement;
    await fixture.whenStable();
  });

  function owning(inventory: InventoryItemDto[]) {
    store.setSnapshot({ ...MOSSY, inventory });
  }

  const buttons = () => [...panel.querySelectorAll<HTMLButtonElement>('button.item')];
  const listed = () =>
    buttons().map((button) => [
      button.querySelector('.name')!.textContent!.trim(),
      button.querySelector('.count')!.textContent!.trim(),
    ]);

  it('lists every item owned with its count, and never a type with none (ITM-01 AC1, AC2)', () => {
    expect(listed()).toEqual([
      ['Clover seeds', '3'],
      ['Pond', '1'],
    ]);
    expect(buttons().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Clover seeds, 3',
      'Pond, 1',
    ]);
  });

  it('follows the inventory as it changes', async () => {
    owning([{ itemType: 'clover', kind: 'seed', count: 1 }]);
    await fixture.whenStable();
    expect(listed()).toEqual([['Clover seed', '1']]);

    owning([]);
    await fixture.whenStable();
    expect(buttons()).toEqual([]);
    expect(panel.textContent).toContain('Nothing in your pockets');
  });

  it('starts placing the chosen item and stops when it is chosen again', async () => {
    const [clover] = buttons();

    clover.click();
    await fixture.whenStable();
    expect(placement.selected()).toEqual({ mode: 'place', itemType: 'clover', kind: 'seed' });
    expect(clover.getAttribute('aria-pressed')).toBe('true');
    expect(buttons()[1].getAttribute('aria-pressed')).toBe('false');

    clover.click();
    await fixture.whenStable();
    expect(placement.selected()).toBeNull();
    expect(clover.getAttribute('aria-pressed')).toBe('false');
  });

  it('says which kind of item was chosen, but not when one is put back (SET-05)', async () => {
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((kind) => chosen.push(kind));
    const [clover, pond] = buttons();

    clover.click();
    panel.querySelector('h3')!.click();
    expect(chosen).toEqual(['seed']);

    pond.click();
    expect(chosen).toEqual(['seed', 'decoration']);

    pond.click();
    expect(placement.selected()).toBeNull();
    expect(chosen).toEqual(['seed', 'decoration']);
  });

  it('stops placing on Escape', async () => {
    buttons()[1].click();
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(placement.selected()).toBeNull();
  });
});
