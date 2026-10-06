import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CreatureDto } from '../core/models/creature';
import { PlanetSnapshotDto } from '../core/models/planet-snapshot';
import { DEFAULT_PLAYER_SETTINGS } from '../core/models/player-settings';
import { CatalogueService } from '../core/services/catalogue.service';
import { ChatService } from '../core/services/chat.service';
import { CardTarget, PlacementService } from '../core/services/placement.service';
import { PlanetIdentityService } from '../core/services/planet-identity.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { ReceiptService } from '../core/services/receipt.service';
import { RewardRevealService } from '../core/services/reward-reveal.service';
import { SyncService } from '../core/services/sync.service';
import { ViewStateService } from '../core/services/view-state.service';
import { NullSceneRenderer } from '../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../scene/scene.providers';
import { SceneService } from '../scene/scene.service';
import { SkyService } from '../scene/sky.service';
import { axeViolations } from '../testing/axe';
import { FakeAudioContext, provideFakeAudio } from '../testing/fake-audio-context';
import { FAKE_MOTION_PROVIDERS } from '../testing/fake-motion';
import {
  CATALOGUE,
  CLOVER_WANT,
  MOSSY,
  creatureAt,
  plantAt,
  wantFulfilled,
} from '../testing/garden-fixtures';
import { FRIDAY_ENTRY, journalEntry } from '../testing/journal-fixtures';
import { TUTORIAL } from '../testing/tutorial-fixtures';
import { AdminComponent } from './admin/admin.component';
import { CatalogueComponent } from './catalogue/catalogue.component';
import { ChatPanelComponent } from './chat-panel/chat-panel.component';
import { CreatePlanetComponent } from './create-planet/create-planet.component';
import { GardenListComponent } from './garden-list/garden-list.component';
import { InfoCardComponent } from './info-card/info-card.component';
import { InventoryPanelComponent } from './inventory-panel/inventory-panel.component';
import { JournalBookComponent } from './journal-book/journal-book.component';
import { JournalPageComponent } from './journal-page/journal-page.component';
import { PlanetPageComponent } from './planet-page/planet-page.component';
import { RewardRevealComponent } from './reward-reveal/reward-reveal.component';
import { SettingsPanelComponent } from './settings-panel/settings-panel.component';
import { ShortcutHelpComponent } from './shortcut-help/shortcut-help.component';
import { SkyListComponent } from './sky-list/sky-list.component';
import { WelcomeBackComponent } from './welcome-back/welcome-back.component';

/**
 * Each screen and panel of the 2D interface, in the states a player meets, has no failure
 * against the WCAG 2.1 A and AA rules axe checks (NFR-05). Contrast is checked on the colour
 * tokens instead (src/styles.spec.ts); the scan of the running app is in the verification
 * record.
 */

const HTTP = [provideHttpClient(), provideHttpClientTesting()];
const SCENE = [SCENE_PROVIDERS, { provide: SCENE_RENDERER, useClass: NullSceneRenderer }];

const mira = creatureAt('mira', 5, 5, { want: CLOVER_WANT });
const sam = creatureAt('sam', 20, 40, { species: 'snail', name: 'Sam', mood: 'cheerful' });

/** A planet with something of everything on it. */
const GARDEN: PlanetSnapshotDto = {
  ...MOSSY,
  plants: [
    plantAt('clover-1', 0, 0, { stage: 'bloom', harvestReady: true }),
    plantAt('mushroom-1', 30, 30, { type: 'mushroom', water: 0.05 }),
  ],
  // The pond beside the clover makes the clover part of Mira's want.
  decorations: [
    { id: 'rock-1', type: 'rock', lat: 10, lon: 10 },
    { id: 'pond-1', type: 'pond', lat: 0, lon: 5 },
  ],
  clouds: [
    { id: 'cloud-1', lat: 0, lon: 0, water: 1, at: MOSSY.serverTime },
    { id: 'cloud-2', lat: 20, lon: 120, water: 0.1, at: MOSSY.serverTime },
  ],
  creatures: [mira, sam],
};

/** Lets pending promise callbacks run, then waits for the re-render. */
async function settle(fixture: ComponentFixture<unknown>) {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

/** The element's button with these words. */
function button(page: HTMLElement, label: string): HTMLButtonElement {
  return [...page.querySelectorAll('button')].find((each) => each.textContent!.trim() === label)!;
}

describe('WCAG 2.1 AA (NFR-05)', () => {
  beforeEach(() => localStorage.clear());

  it('create-planet, with the code form open and a refused name', async () => {
    TestBed.configureTestingModule({ imports: [CreatePlanetComponent], providers: HTTP });
    const fixture = TestBed.createComponent(CreatePlanetComponent);
    const page: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();
    expect(await axeViolations(page)).toEqual([]);

    page.querySelector('details')!.open = true;
    const name = page.querySelector<HTMLInputElement>('app-planet-name-form input')!;
    name.value = 'Grumpy';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button(page, 'Create my planet').click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/planet')
      .flush(
        { statusCode: 400, message: 'That name is not very kind. How about another?' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle(fixture);

    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(await axeViolations(page)).toEqual([]);
  });

  it('the planet page HUD, with Pip, the sky, the inventory and the placement help', async () => {
    TestBed.configureTestingModule({
      imports: [PlanetPageComponent],
      providers: [...HTTP, { provide: SCENE_RENDERER, useClass: NullSceneRenderer }],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(ViewStateService).show('planet');
    const planet = { ...GARDEN, tutorialStep: 2 };
    TestBed.inject(PlanetStore).setSnapshot(planet);
    const fixture = TestBed.createComponent(PlanetPageComponent);
    const page: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    http.expectOne('/api/tutorial').flush(TUTORIAL);
    http.expectOne('/api/planet/settings').flush(DEFAULT_PLAYER_SETTINGS);
    http.expectOne('/api/planet/sync').flush({ snapshot: planet, events: [] });
    // Waits for the first frame, which takes the loading screen away.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle(fixture);

    // Picking the seeds takes Pip on to the next step.
    page.querySelector<HTMLButtonElement>('app-inventory-panel button')!.click();
    await fixture.whenStable();

    expect(page.querySelector('app-pip .text')?.textContent?.trim()).toBe(TUTORIAL.steps[3].text);
    expect(page.querySelector('app-placement-hud .hud')).not.toBeNull();
    expect(page.querySelector('app-loading')).toBeNull();
    expect(await axeViolations(page)).toEqual([]);
  });

  describe('the info card', () => {
    let fixture: ComponentFixture<InfoCardComponent>;
    let page: HTMLElement;
    let placement: PlacementService;

    beforeEach(async () => {
      TestBed.configureTestingModule({
        imports: [InfoCardComponent],
        providers: [...HTTP, ...SCENE, PlacementService],
      });
      TestBed.inject(CatalogueService).load();
      TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
      TestBed.inject(PlanetIdentityService).set(MOSSY.id);
      TestBed.inject(PlanetStore).setSnapshot(GARDEN);
      TestBed.inject(SceneService).resize(800, 600);
      placement = TestBed.inject(PlacementService);
      fixture = TestBed.createComponent(InfoCardComponent);
      page = fixture.nativeElement;
      await fixture.whenStable();
    });

    const target = (kind: CardTarget['kind'], id: string): CardTarget => ({
      kind,
      id,
      x: 300,
      y: 200,
    });

    it('for a plant, hovered, pinned and asking before it is dug up', async () => {
      placement.setHoverCard(target('plant', 'mushroom-1'));
      await fixture.whenStable();
      expect(page.querySelectorAll('.statuses li')).toHaveLength(3);
      expect(await axeViolations(page)).toEqual([]);

      placement.openCard(target('plant', 'clover-1'));
      await fixture.whenStable();
      expect(button(page, 'Collect seeds')).toBeDefined();
      expect(await axeViolations(page)).toEqual([]);

      button(page, 'Dig up').click();
      await fixture.whenStable();
      expect(page.querySelector('[role="alert"]')).not.toBeNull();
      expect(await axeViolations(page)).toEqual([]);
    });

    it('for a decoration, pinned with Move and Put away', async () => {
      placement.openCard(target('decoration', 'rock-1'));
      await fixture.whenStable();

      expect(button(page, 'Put away')).toBeDefined();
      expect(await axeViolations(page)).toEqual([]);
    });

    it('for a creature (the creature card), hovered napping and pinned with its story open', async () => {
      TestBed.inject(SkyService).holdSun(180);
      placement.setHoverCard(target('creature', 'sam'));
      await fixture.whenStable();
      expect(page.querySelector('app-creature-card')?.textContent).toContain('Napping');
      expect(await axeViolations(page)).toEqual([]);

      placement.openCard(target('creature', 'mira'));
      await fixture.whenStable();
      button(page, 'More').click();
      await fixture.whenStable();
      expect(page.querySelector('.voice')?.textContent).toBe(CLOVER_WANT.text);
      expect(page.querySelector('dl.more')).not.toBeNull();
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  describe('the chat panel', () => {
    const worm: CreatureDto = creatureAt('worm-1', 0, 0, { species: 'worm', name: 'Wigglenut' });
    let fixture: ComponentFixture<ChatPanelComponent>;
    let page: HTMLElement;

    beforeEach(async () => {
      TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: [...HTTP, ...SCENE],
      });
      TestBed.inject(ChatService).open(worm.id);
      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.componentRef.setInput('creature', worm);
      page = fixture.nativeElement;
      await fixture.whenStable();
      const at = (minute: number) => `2026-10-02T10:0${minute}:00.000Z`;
      TestBed.inject(HttpTestingController)
        .expectOne('/api/creatures/worm-1/chat')
        .flush({
          messages: [
            { id: 'm1', role: 'user', text: 'Hello, worm!', createdAt: at(1) },
            { id: 'm2', role: 'creature', text: 'Wiggle-hello!', createdAt: at(2) },
            {
              id: 'm3',
              role: 'notice',
              text: 'Real people can help with that.',
              createdAt: at(3),
              link: { label: 'Find a helpline', url: 'https://findahelpline.com' },
            },
          ],
          hasMore: true,
          remaining: 3,
          greeting: 'The soil is extra crumbly today.',
        });
      await settle(fixture);
    });

    it('with earlier messages, a notice from the game and a greeting', async () => {
      expect(page.querySelector('.notice a')).not.toBeNull();
      expect(await axeViolations(page)).toEqual([]);
    });

    it('asking before it forgets the chats', async () => {
      button(page, 'Forget our chats').click();
      await fixture.whenStable();

      expect(button(page, 'Yes, forget')).toBeDefined();
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  it('the journal book, with milestones and older entries to load', async () => {
    TestBed.configureTestingModule({ imports: [JournalBookComponent], providers: HTTP });
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    const fixture = TestBed.createComponent(JournalBookComponent);
    const page: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/journal')
      .flush({ entries: [FRIDAY_ENTRY, journalEntry('thursday', '2026-10-01')], hasMore: true });
    await settle(fixture);

    expect(page.querySelectorAll('.page')).toHaveLength(2);
    expect(await axeViolations(page)).toEqual([]);
  });

  describe('on return', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JournalPageComponent, WelcomeBackComponent],
        providers: [...HTTP, ...SCENE, FAKE_MOTION_PROVIDERS],
      });
      TestBed.inject(PlanetIdentityService).set(MOSSY.id);
      TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    });

    async function comeBack(fixture: ComponentFixture<unknown>) {
      await fixture.whenStable();
      TestBed.inject(SyncService).syncNow();
      TestBed.inject(HttpTestingController)
        .expectOne('/api/planet/sync')
        .flush({
          snapshot: MOSSY,
          events: [],
          welcomeBack: {
            summary: [
              { kind: 'blooms', count: 3, text: '3 plants bloomed', focus: { lat: 12, lon: 0 } },
              { kind: 'gifts', count: 1, text: '1 gift waiting' },
            ],
            journalEntry: FRIDAY_ENTRY,
          },
        });
      await fixture.whenStable();
    }

    it('the journal page', async () => {
      const fixture = TestBed.createComponent(JournalPageComponent);
      await comeBack(fixture);

      expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
      expect(await axeViolations(fixture.nativeElement)).toEqual([]);
    });

    it('the welcome-back summary', async () => {
      const fixture = TestBed.createComponent(WelcomeBackComponent);
      await comeBack(fixture);

      expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
      expect(await axeViolations(fixture.nativeElement)).toEqual([]);
    });
  });

  it('the settings panel, asking before it deletes the planet', async () => {
    TestBed.configureTestingModule({
      imports: [SettingsPanelComponent],
      providers: [...HTTP, provideFakeAudio(new FakeAudioContext())],
    });
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    TestBed.inject(ViewStateService).show('planet');
    const fixture = TestBed.createComponent(SettingsPanelComponent);
    fixture.componentRef.setInput('planet', MOSSY);
    const page: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();
    expect(await axeViolations(page)).toEqual([]);

    button(page, 'Delete my planet').click();
    await fixture.whenStable();

    expect(button(page, 'Yes, delete it')).toBeDefined();
    expect(await axeViolations(page)).toEqual([]);
  });

  it('the catalogue, with found and locked items', async () => {
    TestBed.configureTestingModule({ imports: [CatalogueComponent], providers: HTTP });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    const fixture = TestBed.createComponent(CatalogueComponent);
    const page: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();

    expect(page.querySelector('.locked')).not.toBeNull();
    expect(await axeViolations(page)).toEqual([]);
  });

  it('the reward reveal, with the thank-you', async () => {
    TestBed.configureTestingModule({
      imports: [RewardRevealComponent],
      providers: [
        ...HTTP,
        SceneService,
        ReceiptService,
        RewardRevealService,
        FAKE_MOTION_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot(GARDEN);
    const fixture = TestBed.createComponent(RewardRevealComponent);
    TestBed.tick();
    await fixture.whenStable();
    TestBed.inject(SyncService).syncNow();
    http
      .expectOne('/api/planet/sync')
      .flush({ snapshot: { ...GARDEN, version: 2 }, events: [wantFulfilled(mira)] });
    TestBed.tick();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.reveal .bubble')).not.toBeNull();
    expect(await axeViolations(fixture.nativeElement)).toEqual([]);
  });

  it('the sky list, with a full and an empty cloud and the sun', async () => {
    TestBed.configureTestingModule({ imports: [SkyListComponent], providers: [...HTTP, ...SCENE] });
    TestBed.inject(PlanetStore).setSnapshot(GARDEN);
    const fixture = TestBed.createComponent(SkyListComponent);
    const page: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();
    page.querySelector<HTMLElement>('[role="option"]')!.focus();
    await fixture.whenStable();

    expect(page.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(await axeViolations(page)).toEqual([]);
  });

  it('the inventory panel, with an item chosen and with empty pockets', async () => {
    TestBed.configureTestingModule({
      imports: [InventoryPanelComponent],
      providers: [...HTTP, PlacementService],
    });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    const store = TestBed.inject(PlanetStore);
    store.setSnapshot(MOSSY);
    const fixture = TestBed.createComponent(InventoryPanelComponent);
    const page: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button.item')!.click();
    await fixture.whenStable();
    expect(page.querySelector('[aria-pressed="true"]')).not.toBeNull();
    expect(await axeViolations(page)).toEqual([]);

    store.setSnapshot({ ...MOSSY, inventory: [] });
    await fixture.whenStable();

    expect(page.querySelector('button.item')).toBeNull();
    expect(await axeViolations(page)).toEqual([]);
  });

  it('the garden list, with an object picked', async () => {
    TestBed.configureTestingModule({
      imports: [GardenListComponent],
      providers: [...HTTP, ...SCENE, PlacementService, FAKE_MOTION_PROVIDERS],
    });
    TestBed.inject(PlanetStore).setSnapshot(GARDEN);
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(SceneService).resize(800, 600);
    const fixture = TestBed.createComponent(GardenListComponent);
    const page: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();
    page.querySelector<HTMLElement>('[role="option"]')!.focus();
    await fixture.whenStable();

    expect(page.querySelectorAll('[role="option"]').length).toBeGreaterThan(1);
    expect(await axeViolations(page)).toEqual([]);
  });

  it('the keyboard shortcut help', async () => {
    const fixture = TestBed.createComponent(ShortcutHelpComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('kbd')).not.toBeNull();
    expect(await axeViolations(fixture.nativeElement)).toEqual([]);
  });

  it("the game owner's page", async () => {
    TestBed.configureTestingModule({ imports: [AdminComponent], providers: HTTP });
    const fixture = TestBed.createComponent(AdminComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/admin/settings')
      .flush({ aiEnabled: false, aiDailyBudget: 300, aiRequestsToday: 12 });
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('button.switch')).not.toBeNull();
    expect(await axeViolations(fixture.nativeElement)).toEqual([]);
  });
});
