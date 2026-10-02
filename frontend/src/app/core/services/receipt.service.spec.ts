import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CATALOGUE, MOSSY } from '../../testing/garden-fixtures';
import { InventoryItemDto } from '../models/planet-snapshot';
import { CatalogueService } from './catalogue.service';
import { PlanetStore } from './planet-store.service';
import { RECEIPT_MS, ReceiptService } from './receipt.service';

describe('ReceiptService', () => {
  let store: PlanetStore;
  let receipts: ReceiptService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReceiptService],
    });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    store = TestBed.inject(PlanetStore);
    receipts = TestBed.inject(ReceiptService);
    store.setSnapshot(MOSSY);
    TestBed.tick();
  });

  afterEach(() => vi.useRealTimers());

  const owning = (inventory: InventoryItemDto[], id = MOSSY.id) => {
    store.setSnapshot({ ...MOSSY, id, inventory });
    TestBed.tick();
  };
  const texts = () => receipts.receipts().map(({ text }) => text);

  it('says nothing about what the planet already had when it opened', () => {
    expect(texts()).toEqual([]);
  });

  it('announces each count that went up, once (ITM-01 AC3)', () => {
    owning([
      { itemType: 'clover', kind: 'seed', count: 5 },
      { itemType: 'pond', kind: 'decoration', count: 1 },
      { itemType: 'rock', kind: 'decoration', count: 1 },
    ]);
    expect(texts()).toEqual(['+2 Clover seeds', '+1 Rock']);

    // The next heartbeat brings the same counts.
    owning([
      { itemType: 'clover', kind: 'seed', count: 5 },
      { itemType: 'pond', kind: 'decoration', count: 1 },
      { itemType: 'rock', kind: 'decoration', count: 1 },
    ]);
    expect(texts()).toEqual(['+2 Clover seeds', '+1 Rock']);
  });

  it('says nothing when items are used up', () => {
    owning([{ itemType: 'clover', kind: 'seed', count: 2 }]);
    owning([]);

    expect(texts()).toEqual([]);
  });

  it('counts an item that was used up and came back', () => {
    owning([]);
    owning([{ itemType: 'clover', kind: 'seed', count: 1 }]);

    expect(texts()).toEqual(['+1 Clover seed']);
  });

  it('starts afresh when another planet opens', () => {
    owning([{ itemType: 'clover', kind: 'seed', count: 9 }], 'another-planet');
    store.clear();
    TestBed.tick();
    owning([{ itemType: 'clover', kind: 'seed', count: 12 }], 'another-planet');

    expect(texts()).toEqual([]);
  });

  it('lets each receipt go after its time', () => {
    owning([{ itemType: 'clover', kind: 'seed', count: 4 }]);
    vi.advanceTimersByTime(RECEIPT_MS / 2);
    owning([
      { itemType: 'clover', kind: 'seed', count: 4 },
      { itemType: 'sunflower', kind: 'seed', count: 1 },
    ]);

    expect(texts()).toEqual(['+1 Clover seed', '+1 Sunflower seed']);
    vi.advanceTimersByTime(RECEIPT_MS / 2);
    expect(texts()).toEqual(['+1 Sunflower seed']);
    vi.advanceTimersByTime(RECEIPT_MS / 2);
    expect(texts()).toEqual([]);
  });
});
