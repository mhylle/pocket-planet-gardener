import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CreatureDto } from '../../core/models/creature';
import { CatalogueService } from '../../core/services/catalogue.service';
import { CELEBRATION_MS, CelebrationService } from '../../core/services/celebration.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { SyncService } from '../../core/services/sync.service';
import { CATALOGUE, MOSSY, creatureAt } from '../../testing/garden-fixtures';
import { CelebrationComponent } from './celebration.component';

describe('CelebrationComponent', () => {
  let fixture: ComponentFixture<CelebrationComponent>;
  let http: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [CelebrationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CelebrationService,
        ReceiptService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function render() {
    fixture = TestBed.createComponent(CelebrationComponent);
    host = fixture.nativeElement;
    TestBed.inject(ReceiptService);
    TestBed.tick();
    fixture.detectChanges();
  }

  /** A command whose response brings a tulip seed, named as newly unlocked. */
  async function getTulip(version: number) {
    const sent = TestBed.inject(SyncService).send({
      method: 'POST',
      path: '/garden/gift',
      body: {},
    });
    http.expectOne('/api/garden/gift').flush({
      snapshot: {
        ...MOSSY,
        version,
        inventory: [...MOSSY.inventory, { itemType: 'tulip', kind: 'seed', count: version - 1 }],
        unlocks: [...MOSSY.unlocks, 'tulip'],
      },
      events: [],
      newlyUnlocked: ['tulip'],
    });
    await sent;
    TestBed.tick();
    fixture.detectChanges();
  }

  const celebrations = () => [...host.querySelectorAll('[aria-live="polite"] .celebration')];
  const texts = () =>
    celebrations().map((each) => each.querySelector('.text')!.textContent!.trim());

  it('celebrates a first-time item once, with sparkles, and no "New:" receipt (ITM-04 AC3)', async () => {
    render();

    await getTulip(2);
    await getTulip(3);

    expect(texts()).toEqual(['New in your catalogue: Tulip']);
    expect(celebrations()[0].classList.contains('burst')).toBe(true);
    expect(celebrations()[0].querySelectorAll('.sparkle').length).toBeGreaterThan(0);
    const receipts = TestBed.inject(ReceiptService)
      .receipts()
      .map(({ text }) => text);
    expect(receipts.some((text) => text.startsWith('New'))).toBe(false);

    vi.advanceTimersByTime(CELEBRATION_MS);
    fixture.detectChanges();
    expect(celebrations()).toEqual([]);
  });

  it('cheers each creature that moves in once, but none that were there already (CRT-01 AC1)', () => {
    const store = TestBed.inject(PlanetStore);
    const sam = creatureAt('sam', 0, 0, { species: 'snail', name: 'Sam' });
    const mira = creatureAt('mira', 10, 10);
    const show = (version: number, creatures: CreatureDto[]) => {
      store.setSnapshot({ ...MOSSY, version, creatures });
      TestBed.tick();
      fixture.detectChanges();
    };
    store.setSnapshot({ ...MOSSY, creatures: [sam] });
    render();
    expect(texts()).toEqual([]);

    show(2, [sam, mira]);
    show(3, [sam, mira]);

    expect(texts()).toEqual(['Mira the moth moved in!']);
  });

  it('only fades, without the sparkle burst, when the device asks for reduced motion (SET-03)', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }));
    render();

    await getTulip(2);

    expect(texts()).toEqual(['New in your catalogue: Tulip']);
    expect(celebrations()[0].classList.contains('burst')).toBe(false);
  });
});
