import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { RECEIPT_MS, ReceiptService } from '../../core/services/receipt.service';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../../testing/fake-motion';
import { CATALOGUE, MOSSY } from '../../testing/garden-fixtures';
import { ReceiptToastComponent } from './receipt-toast.component';

describe('ReceiptToastComponent', () => {
  let fixture: ComponentFixture<ReceiptToastComponent>;
  let store: PlanetStore;
  let host: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [ReceiptToastComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FAKE_MOTION_PROVIDERS,
        ReceiptService,
      ],
    });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    store = TestBed.inject(PlanetStore);
    store.setSnapshot(MOSSY);
  });

  afterEach(() => vi.useRealTimers());

  /** Runs effects, then draws the toasts. */
  function settle() {
    TestBed.tick();
    fixture.detectChanges();
  }

  function render() {
    fixture = TestBed.createComponent(ReceiptToastComponent);
    host = fixture.nativeElement;
    settle();
  }

  /** The planet gains a clover seed, as when a seed is dug up. */
  function gainClover() {
    store.setSnapshot({
      ...MOSSY,
      inventory: [
        { itemType: 'clover', kind: 'seed', count: 4 },
        { itemType: 'pond', kind: 'decoration', count: 1 },
      ],
    });
    settle();
  }

  const receipts = () => [...host.querySelectorAll('[aria-live="polite"] .receipt')];

  it('shows each new item once, flying into the inventory (ITM-01 AC3)', () => {
    render();
    expect(receipts()).toEqual([]);

    gainClover();
    // The next heartbeat brings the same inventory.
    gainClover();

    expect(receipts().map((each) => each.textContent!.trim())).toEqual(['+1 Clover seed']);
    expect(receipts()[0].classList.contains('still')).toBe(false);

    vi.advanceTimersByTime(RECEIPT_MS);
    settle();
    expect(receipts()).toEqual([]);
  });

  it('only fades with reduced motion, following the setting as it changes (SET-03)', () => {
    render();
    gainClover();
    expect(receipts()[0].classList.contains('still')).toBe(false);

    TestBed.inject(FakeMotionPreference).reduced.set(true);
    settle();

    expect(receipts()[0].classList.contains('still')).toBe(true);
  });
});
