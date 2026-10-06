import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { MockInstance } from 'vitest';
import { EventDto, InventoryItemDto } from '../../core/models/planet-snapshot';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ReceiptService } from '../../core/services/receipt.service';
import { RewardRevealService } from '../../core/services/reward-reveal.service';
import { SyncService } from '../../core/services/sync.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SceneService } from '../../scene/scene.service';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../../testing/fake-motion';
import {
  CATALOGUE,
  MOSSY,
  THANK_YOU,
  creatureAt,
  giftReceived,
  wantFulfilled,
} from '../../testing/garden-fixtures';
import { RewardRevealComponent } from './reward-reveal.component';

const mira = creatureAt('mira', 5, 5);
const sam = creatureAt('sam', 20, 40, { species: 'snail', name: 'Sam' });
const tulips: InventoryItemDto = { itemType: 'tulip', kind: 'seed', count: 2 };
const rock: InventoryItemDto = { itemType: 'rock', kind: 'decoration', count: 1 };

describe('RewardRevealComponent', () => {
  let fixture: ComponentFixture<RewardRevealComponent>;
  let http: HttpTestingController;
  let receipts: ReceiptService;
  let focusCanvas: MockInstance<SceneService['focusCanvas']>;
  let host: HTMLElement;
  let version: number;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RewardRevealComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SceneService,
        ReceiptService,
        RewardRevealService,
        FAKE_MOTION_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot({ ...MOSSY, creatures: [mira, sam] });
    focusCanvas = vi.spyOn(TestBed.inject(SceneService), 'focusCanvas');
    receipts = TestBed.inject(ReceiptService);
    version = 2;
  });

  afterEach(() => http.verify());

  async function render() {
    fixture = TestBed.createComponent(RewardRevealComponent);
    host = fixture.nativeElement;
    TestBed.tick();
    await fixture.whenStable();
  }

  /** A heartbeat whose response brings the events and the items they hand over. */
  async function heartbeat(events: EventDto[], gained: InventoryItemDto[]) {
    TestBed.inject(SyncService).syncNow();
    http.expectOne('/api/planet/sync').flush({
      snapshot: {
        ...MOSSY,
        version: version++,
        creatures: [mira, sam],
        inventory: [...MOSSY.inventory, ...gained],
      },
      events,
    });
    TestBed.tick();
    await fixture.whenStable();
  }

  async function dismiss() {
    button()!.click();
    TestBed.tick();
    await fixture.whenStable();
  }

  const reveal = () => host.querySelector<HTMLElement>('.reveal[role="dialog"]');
  const bubble = () => reveal()?.querySelector('.bubble')?.textContent?.trim();
  const lead = () => reveal()?.querySelector('.lead')?.textContent?.trim();
  const items = () =>
    [...(reveal()?.querySelectorAll('.items li') ?? [])].map((each) => each.textContent!.trim());
  const button = () => reveal()?.querySelector('button');
  const receiptTexts = () => receipts.receipts().map(({ text }) => text);

  it('shows the thank-you and the reward first; the receipt waits until it is put away (WNT-03 AC1, WNT-04 AC1)', async () => {
    await render();

    await heartbeat([wantFulfilled(mira)], [tulips]);

    expect(bubble()).toBe(THANK_YOU);
    expect(lead()).toBe('Mira gives you:');
    expect(items()).toEqual(['2 × Tulip seeds']);
    expect(reveal()!.getAttribute('aria-labelledby')).toBe(
      'reward-reveal-lead reward-reveal-items',
    );
    expect(reveal()!.getAttribute('aria-describedby')).toBe('reward-reveal-thanks');
    expect(document.activeElement).toBe(button());
    expect(receiptTexts()).toEqual([]);

    await dismiss();

    expect(reveal()).toBeNull();
    expect(receiptTexts()).toEqual(['+2 Tulip seeds']);
  });

  it('hops in (SET-03)', async () => {
    await render();

    await heartbeat([wantFulfilled(mira)], [tulips]);

    expect(reveal()!.classList.contains('hop')).toBe(true);
  });

  it('only fades in, without the hop, with reduced motion (SET-03)', async () => {
    TestBed.inject(FakeMotionPreference).reduced.set(true);
    await render();

    await heartbeat([wantFulfilled(mira)], [tulips]);

    expect(lead()).toBe('Mira gives you:');
    expect(reveal()!.classList.contains('hop')).toBe(false);
  });

  it("shows an overjoyed creature's present the same way, without a thank-you (CRT-04 AC2)", async () => {
    await render();

    await heartbeat([giftReceived(sam)], [rock]);

    expect(bubble()).toBeUndefined();
    expect(lead()).toBe('Sam has a present for you:');
    expect(items()).toEqual(['1 × Rock']);
    expect(reveal()!.getAttribute('aria-describedby')).toBeNull();
    expect(receiptTexts()).toEqual([]);

    await dismiss();
    expect(receiptTexts()).toEqual(['+1 Rock']);
  });

  it('shows one at a time in order, then gives the focus back to where it was', async () => {
    const outside = document.body.appendChild(document.createElement('button'));
    outside.focus();
    await render();

    await heartbeat([wantFulfilled(mira), giftReceived(sam)], [tulips, rock]);

    expect(lead()).toBe('Mira gives you:');
    await dismiss();
    expect(lead()).toBe('Sam has a present for you:');
    expect(document.activeElement).toBe(button());
    expect(receiptTexts()).toEqual([]);

    await dismiss();
    expect(reveal()).toBeNull();
    expect(receiptTexts()).toEqual(['+2 Tulip seeds', '+1 Rock']);
    expect(document.activeElement).toBe(outside);
    expect(focusCanvas).not.toHaveBeenCalled();
    outside.remove();
  });

  it('gives the focus to the planet when nothing else had it', async () => {
    await render();
    await heartbeat([wantFulfilled(mira)], [tulips]);

    await dismiss();

    expect(focusCanvas).toHaveBeenCalled();
  });

  it('ignores other events', async () => {
    await render();

    await heartbeat([{ type: 'plant-bloomed', occurredAt: MOSSY.serverTime, payload: {} }], []);

    expect(reveal()).toBeNull();
  });
});
