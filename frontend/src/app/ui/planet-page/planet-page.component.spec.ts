import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLANET_VISIBLE_MARK, TIME_TO_PLANET_MEASURE } from '../../core/helpers/perf';
import { PlanetSnapshotDto, WelcomeBack } from '../../core/models/planet-snapshot';
import { DEFAULT_PLAYER_SETTINGS } from '../../core/models/player-settings';
import { ChatService } from '../../core/services/chat.service';
import { MotionPreferenceService } from '../../core/services/motion-preference.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SettingsService } from '../../core/services/settings.service';
import { SyncService } from '../../core/services/sync.service';
import { ViewStateService } from '../../core/services/view-state.service';
import { CreatureMeshService } from '../../scene/creature-mesh.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import {
  CATALOGUE,
  CLOVER_WANT,
  THANK_YOU,
  creatureAt,
  plantAt,
  wantFulfilled,
} from '../../testing/garden-fixtures';
import { FRIDAY_ENTRY, journalEntry } from '../../testing/journal-fixtures';
import { TUTORIAL } from '../../testing/tutorial-fixtures';
import { PlanetPageComponent } from './planet-page.component';

const mossy: PlanetSnapshotDto = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  code: 'MOSS2345',
  name: 'Mossy',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  radiusLevel: 1,
  maxPlants: 60,
  tutorialStep: 0,
  serverTime: '2026-10-01T10:00:00.000Z',
  plants: [],
  decorations: [],
  inventory: [],
  unlocks: [],
  clouds: [],
  sun: { angle: 0, overrideAngle: null, overrideAt: null },
  creatures: [],
};

describe('PlanetPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PlanetPageComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    // The page's deferred panels make its metadata load asynchronously.
    await TestBed.configureTestingModule({
      imports: [PlanetPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(mossy.id);
    TestBed.inject(ViewStateService).show('planet');
  });

  afterEach(() => {
    // The page asks for the catalogue for the inventory names, for Pip's script, and syncs and
    // loads the settings once the planet is shown; the specs that do not need these leave them
    // unanswered.
    http.match('/api/catalogue');
    http.match('/api/tutorial');
    http.match('/api/planet/sync');
    http.match('/api/planet/settings');
    http.verify();
    vi.useRealTimers();
  });

  function render() {
    fixture = TestBed.createComponent(PlanetPageComponent);
    page = fixture.nativeElement;
    fixture.detectChanges();
  }

  /** Lets pending promise callbacks run, then waits for the re-render. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const heading = () => page.querySelector('h2')?.textContent?.trim();
  const pip = () => page.querySelector('app-loading');
  const canvas = () => page.querySelector('app-planet-view canvas');
  const failWith = (status: number) =>
    http.expectOne('/api/planet').flush({ statusCode: status }, { status, statusText: 'Error' });

  it('shows a planet that is already loaded without asking the server again', async () => {
    TestBed.inject(PlanetStore).setSnapshot(mossy);

    render();
    await fixture.whenStable();

    expect(heading()).toBe('Mossy');
    expect(canvas()).not.toBeNull();
  });

  it("applies the planet's sound and motion settings while it is shown (SET-01 AC2)", async () => {
    TestBed.inject(PlanetStore).setSnapshot(mossy);
    const settings = TestBed.inject(SettingsService);

    render();
    await fixture.whenStable();
    http
      .expectOne({ method: 'GET', url: '/api/planet/settings' })
      .flush({ ...DEFAULT_PLAYER_SETTINGS, musicMuted: true, reducedMotion: 'on' });

    expect(settings.settings().musicMuted).toBe(true);
    expect(TestBed.inject(MotionPreferenceService).reduced()).toBe(true);

    fixture.destroy();
    expect(settings.settings()).toEqual(DEFAULT_PLAYER_SETTINGS);
  });

  describe('keyboard-only play (SET-05)', () => {
    const tabStops = () =>
      [...page.querySelectorAll<HTMLElement>('[tabindex], button, input, textarea')].filter(
        (element) => element.tabIndex === 0 && !(element as HTMLButtonElement).disabled,
      );
    /** The part of the page a Tab stop is in: its nearest component, or the menu buttons. */
    const partOf = (element: Element) => {
      if (element.closest('.menu')) {
        return 'menu';
      }
      let part: Element | null = element;
      while (part && !part.tagName.startsWith('APP-')) {
        part = part.parentElement;
      }
      return part?.tagName.toLowerCase();
    };
    const optionsOf = (list: string) => [
      ...page.querySelectorAll<HTMLElement>(`${list} [role="option"]`),
    ];
    const keydown = (target: Element, key: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const helpDialog = () => page.querySelector<HTMLElement>('#shortcut-help [role="dialog"]');

    beforeEach(() =>
      TestBed.inject(PlanetStore).setSnapshot({
        ...mossy,
        creatures: [creatureAt('mira', 5, 5)],
        plants: [plantAt('clover-1', -5, 10)],
        clouds: [{ id: 'cloud-1', lat: 0, lon: 0, water: 1, at: mossy.serverTime }],
        inventory: [{ itemType: 'clover', kind: 'seed', count: 2 }],
      }),
    );

    it('goes from the canvas to the garden list, then the sky, the inventory and the menus (GRD-02 AC4)', async () => {
      render();
      await fixture.whenStable();

      const parts = tabStops().map(partOf);
      expect(parts.filter((part, i) => part !== parts[i - 1])).toEqual([
        'app-planet-view',
        'app-garden-list',
        'app-sky-list',
        'app-inventory-panel',
        'menu',
      ]);
      // The garden list is one Tab stop, whatever is on the planet.
      expect(parts.filter((part) => part === 'app-garden-list')).toHaveLength(1);
      expect(
        tabStops()
          .filter((stop) => partOf(stop) === 'menu')
          .map((stop) => stop.textContent!.trim()),
      ).toEqual(['Catalogue', 'Journal', 'Settings', 'Shortcuts']);
    });

    it('goes on from a menu button into the panel it opened', async () => {
      render();
      await fixture.whenStable();
      page.querySelector<HTMLButtonElement>('button[aria-controls="settings-panel"]')!.click();
      await fixture.whenStable();

      const stops = tabStops();
      const settings = stops.findIndex((stop) => stop.textContent?.trim() === 'Shortcuts');
      expect(stops[settings + 1].closest('app-settings-panel')).not.toBeNull();
    });

    it("opens a creature's card from the garden list with Enter, and the card leads on to chat (CHT-01 AC1)", async () => {
      render();
      await fixture.whenStable();
      const [mira] = optionsOf('app-garden-list');
      expect(mira.textContent?.trim()).toBe('Mira the moth, content');

      mira.focus();
      keydown(mira, 'Enter');
      await fixture.whenStable();

      const card = page.querySelector<HTMLElement>('app-info-card [role="dialog"]')!;
      expect(card.querySelector('#info-card-title')?.textContent?.trim()).toBe('Mira');
      const chat = document.activeElement as HTMLButtonElement;
      expect(card.contains(chat)).toBe(true);
      expect(chat.textContent?.trim()).toBe('Chat');

      chat.click();
      await fixture.whenStable();
      http
        .expectOne({ method: 'GET', url: '/api/creatures/mira/chat' })
        .flush({ messages: [], hasMore: false, remaining: 30, greeting: 'Hello!' });
      await settle();
      expect(page.querySelector('app-chat-panel #chat-title')?.textContent?.trim()).toBe(
        'Chat with Mira',
      );
    });

    it('hands the keys to the planet once a seed is chosen, saying what to do next', async () => {
      render();
      await fixture.whenStable();
      const seed = page.querySelector<HTMLButtonElement>('app-inventory-panel button')!;

      seed.focus();
      seed.click();
      await fixture.whenStable();

      expect(fixture.debugElement.injector.get(PlacementService).selected()?.itemType).toBe(
        'clover',
      );
      expect(document.activeElement).toBe(canvas());
      expect(page.querySelector('.stage > .announcer[aria-live="polite"]')?.textContent).toBe(
        'Turn the planet with the arrows, then press Enter to plant at the ring',
      );
    });

    it('opens the shortcut help on "?", but not while typing, and Escape puts the focus back', async () => {
      render();
      await fixture.whenStable();
      const box = document.createElement('textarea');
      page.append(box);

      box.focus();
      keydown(box, '?');
      await fixture.whenStable();
      expect(helpDialog()).toBeNull();

      const planet = canvas() as HTMLElement;
      planet.focus();
      keydown(planet, '?');
      await fixture.whenStable();
      expect(document.activeElement).toBe(helpDialog());
      expect(
        page.querySelector('button[aria-controls="shortcut-help"]')!.getAttribute('aria-expanded'),
      ).toBe('true');

      keydown(helpDialog()!, 'Escape');
      await fixture.whenStable();
      expect(helpDialog()).toBeNull();
      expect(document.activeElement).toBe(planet);
    });

    it('opens and closes the shortcut help from its button', async () => {
      render();
      await fixture.whenStable();
      const button = page.querySelector<HTMLButtonElement>(
        'button[aria-controls="shortcut-help"]',
      )!;

      button.click();
      await fixture.whenStable();
      expect(helpDialog()?.textContent).toContain('Keyboard shortcuts');

      button.click();
      await fixture.whenStable();
      expect(helpDialog()).toBeNull();
    });
  });

  it('shows Pip while the planet loads and until it is first drawn (NFR-03)', async () => {
    vi.useFakeTimers();
    render();

    expect(pip()?.querySelector('[role="status"]')?.textContent).toContain(
      'Pip is fetching your planet',
    );
    expect(canvas()).toBeNull();

    http.expectOne({ method: 'GET', url: '/api/planet' }).flush(mossy);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(heading()).toBe('Mossy');
    expect(canvas()).not.toBeNull();
    expect(pip()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(50);
    fixture.detectChanges();

    expect(pip()).toBeNull();
    expect(canvas()).not.toBeNull();
  });

  describe("timing a returning player's start (NFR-03)", () => {
    const startUrl = location.href;
    const marks = () => performance.getEntriesByName(PLANET_VISIBLE_MARK, 'mark');
    const measures = () => performance.getEntriesByName(TIME_TO_PLANET_MEASURE, 'measure');

    beforeEach(() => {
      performance.clearMarks();
      performance.clearMeasures();
      TestBed.inject(PlanetStore).setSnapshot(mossy);
    });

    afterEach(() => {
      history.replaceState(null, '', startUrl);
      performance.clearMarks();
      performance.clearMeasures();
      vi.restoreAllMocks();
    });

    it('marks the planet first drawn, and with ?perf=1 says how long it took', async () => {
      history.replaceState(null, '', '?perf=1');
      const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      render();
      expect(marks()).toEqual([]);

      // The first frame takes the loading screen away.
      await new Promise((resolve) => setTimeout(resolve, 50));
      await fixture.whenStable();

      expect(pip()).toBeNull();
      expect(marks()).toHaveLength(1);
      expect(measures()).toHaveLength(1);
      expect(measures()[0].startTime).toBe(0);
      expect(info).toHaveBeenCalledWith(
        `[ppg perf] planet visible after ${Math.round(marks()[0].startTime)} ms`,
      );
    });

    it('logs nothing without ?perf=1', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      render();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await fixture.whenStable();

      expect(marks()).toHaveLength(1);
      expect(info).not.toHaveBeenCalled();
    });

    it('does not time a planet opened from create-planet', async () => {
      const views = TestBed.inject(ViewStateService);
      views.show('create-planet');
      views.show('planet');
      render();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await fixture.whenStable();

      expect(pip()).toBeNull();
      expect(marks()).toEqual([]);
    });
  });

  it('returns to create-planet when the planet has drifted away', async () => {
    render();
    failWith(404);
    await settle();

    expect(localStorage.getItem('ppg.planetId')).toBeNull();
    expect(TestBed.inject(ViewStateService).view()).toBe('create-planet');
  });

  it('offers a retry when the server cannot be reached, keeping the planet id', async () => {
    render();
    failWith(500);
    await settle();

    const alert = page.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("couldn't reach your planet");
    expect(localStorage.getItem('ppg.planetId')).toBe(mossy.id);

    alert.querySelector('button')!.click();
    http.expectOne('/api/planet').flush(mossy);
    await settle();

    expect(heading()).toBe('Mossy');
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });

  it('opens and closes the settings panel', async () => {
    render();
    http.expectOne('/api/planet').flush(mossy);
    await settle();
    const settings = page.querySelector<HTMLButtonElement>(
      'button[aria-controls="settings-panel"]',
    )!;

    expect(settings.getAttribute('aria-expanded')).toBe('false');
    expect(page.querySelector('app-settings-panel')).toBeNull();

    settings.click();
    await fixture.whenStable();
    expect(settings.getAttribute('aria-expanded')).toBe('true');
    expect(page.querySelector('#settings-panel .code')?.textContent).toBe('MOSS2345');

    settings.click();
    await fixture.whenStable();
    expect(page.querySelector('app-settings-panel')).toBeNull();
  });

  it('opens the catalogue from its button, and Escape closes it with the focus back (ITM-03)', async () => {
    render();
    http.expectOne('/api/planet').flush(mossy);
    await settle();
    const button = page.querySelector<HTMLButtonElement>(
      'button[aria-controls="catalogue-panel"]',
    )!;

    button.focus();
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const dialog = page.querySelector<HTMLElement>('#catalogue-panel [role="dialog"]')!;
    expect(document.activeElement).toBe(dialog);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(page.querySelector('app-catalogue')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("shows a creature's chat beside the planet, which stays in play (CHT-01 AC1, AIB-04 AC1)", async () => {
    TestBed.inject(PlanetStore).setSnapshot({ ...mossy, creatures: [creatureAt('mira', 5, 5)] });
    render();
    await fixture.whenStable();
    const chat = TestBed.inject(ChatService);

    chat.open('mira');
    await fixture.whenStable();
    http
      .expectOne({ method: 'GET', url: '/api/creatures/mira/chat' })
      .flush({ messages: [], hasMore: false, remaining: 30, greeting: 'Hello!' });
    await settle();

    expect(page.querySelector('app-chat-panel #chat-title')?.textContent?.trim()).toBe(
      'Chat with Mira',
    );
    expect(canvas()).not.toBeNull();
    expect(page.querySelector('app-inventory-panel')).not.toBeNull();

    chat.close();
    await fixture.whenStable();
    expect(page.querySelector('app-chat-panel')).toBeNull();
  });

  it('shows no chat for a creature that is not on this planet', async () => {
    TestBed.inject(PlanetStore).setSnapshot(mossy);
    TestBed.inject(ChatService).open('elsewhere');

    render();
    await fixture.whenStable();

    expect(page.querySelector('app-chat-panel')).toBeNull();
  });

  describe('saving and sync', () => {
    const PLANT = '/api/garden/plant';
    const SYNC = '/api/planet/sync';
    const note = () => page.querySelector('app-save-indicator')!.textContent!.trim();
    const plant = () =>
      TestBed.inject(SyncService).send({
        method: 'POST',
        path: '/garden/plant',
        body: { type: 'clover' },
      });
    const unreachable = () => http.expectOne(PLANT).error(new ProgressEvent('error'));
    /** Answers the sync the page sends as soon as the planet is shown. */
    const firstSync = (welcomeBack?: WelcomeBack) =>
      http
        .expectOne({ method: 'POST', url: SYNC })
        .flush({ snapshot: mossy, events: [], welcomeBack });

    beforeEach(() => TestBed.inject(PlanetStore).setSnapshot(mossy));

    it('shows a calm note while the connection is down and hides it once saved (ACC-03)', async () => {
      vi.useFakeTimers();
      render();
      firstSync();
      const saved = plant();
      fixture.detectChanges();
      expect(note()).toBe('Saving…');

      unreachable();
      fixture.detectChanges();
      expect(note()).toBe("Offline — your changes will be saved when you're back");

      vi.advanceTimersByTime(1000);
      unreachable();
      vi.advanceTimersByTime(2000);
      unreachable();
      vi.advanceTimersByTime(4000);
      http
        .expectOne(PLANT)
        .flush({ snapshot: { ...mossy, name: 'Mossy Hill', version: 2 }, events: [] });
      await saved;
      fixture.detectChanges();

      expect(note()).toBe('');
      expect(heading()).toBe('Mossy Hill');
    });

    it('asks for a reload when another device changed the planet (ACC-04 AC2)', async () => {
      render();
      firstSync();
      await fixture.whenStable();
      expect(page.querySelector('app-reload-banner [role="alert"]')).toBeNull();

      const refused = plant().catch((error: unknown) => error);
      http
        .expectOne(PLANT)
        .flush({ statusCode: 409, message: 'reload' }, { status: 409, statusText: 'Conflict' });
      await refused;
      await fixture.whenStable();

      expect(page.querySelector('app-reload-banner [role="alert"]')?.textContent).toContain(
        'This planet changed on another device',
      );
    });

    it('syncs at once when the planet is shown, then on the heartbeat, and stops when the page closes', () => {
      vi.useFakeTimers();
      render();

      firstSync();
      vi.advanceTimersByTime(9_999);
      http.expectNone(SYNC);
      vi.advanceTimersByTime(1);
      http.expectOne({ method: 'POST', url: SYNC }).flush({ snapshot: mossy, events: [] });

      fixture.destroy();
      vi.advanceTimersByTime(60_000);
      http.expectNone(SYNC);
    });

    it('does not sync while the planet is still loading, and syncs at once after it loads', async () => {
      TestBed.inject(PlanetStore).clear();
      vi.useFakeTimers();
      render();

      vi.advanceTimersByTime(10_000);
      http.expectNone(SYNC);
      http.expectOne('/api/planet').flush(mossy);
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      firstSync();
      vi.advanceTimersByTime(10_000);
      http.expectOne(SYNC).flush({ snapshot: mossy, events: [] });
    });

    it('shows what changed from the first sync to a returning player (TIM-03)', async () => {
      render();
      firstSync({ summary: [{ kind: 'blooms', count: 1, text: '1 plant bloomed' }] });
      await fixture.whenStable();

      const summary = page.querySelector<HTMLElement>('app-welcome-back [role="dialog"]')!;
      expect(summary.textContent).toContain('Welcome back!');
      expect(summary.textContent).toContain('1 plant bloomed');
      expect(document.activeElement).toBe(summary);
    });

    describe('the journal', () => {
      const SUMMARY = [{ kind: 'blooms' as const, count: 1, text: '1 plant bloomed' }];
      const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
      const returnDialogs = () => [
        ...page.querySelectorAll<HTMLElement>('.return [role="dialog"]'),
      ];
      const journalPage = () => page.querySelector<HTMLElement>('app-journal-page [role="dialog"]');
      const journalButton = () =>
        page.querySelector<HTMLButtonElement>('button[aria-controls="journal-panel"]')!;
      const bookDates = () =>
        [...page.querySelectorAll('#journal-panel .page h4')].map((each) => text(each));

      it('opens the diary page above the welcome-back summary on return (JRN-01 AC1)', async () => {
        render();
        firstSync({ summary: SUMMARY, journalEntry: FRIDAY_ENTRY });
        await fixture.whenStable();

        const [diary, summary] = returnDialogs();
        expect(diary).toBe(journalPage());
        expect(text(diary.querySelector('h3')!)).toBe('Friday, 2 October');
        expect(diary.querySelector('.text')!.textContent).toBe(FRIDAY_ENTRY.text);
        expect(summary.closest('app-welcome-back')).not.toBeNull();
        expect(text(summary)).toContain('1 plant bloomed');
        expect(document.activeElement).toBe(diary);
      });

      it('loads the diary page only once one waits (NFR-03)', async () => {
        render();
        firstSync({ summary: SUMMARY });
        await fixture.whenStable();

        expect(page.querySelector('app-journal-page')).toBeNull();
        expect(returnDialogs().map((dialog) => dialog.closest('app-welcome-back'))).not.toContain(
          null,
        );
      });

      it('shows just the diary page when nothing else changed', async () => {
        render();
        firstSync({ summary: [], journalEntry: FRIDAY_ENTRY });
        await fixture.whenStable();

        expect(returnDialogs()).toEqual([journalPage()]);
      });

      it('finds a closed diary page again first in the book (JRN-01 AC3, JRN-03 AC1)', async () => {
        render();
        firstSync({ summary: [], journalEntry: FRIDAY_ENTRY });
        await fixture.whenStable();

        journalPage()!.querySelector<HTMLButtonElement>('button.close')!.click();
        await fixture.whenStable();
        expect(journalPage()).toBeNull();

        journalButton().click();
        await fixture.whenStable();
        expect(journalButton().getAttribute('aria-expanded')).toBe('true');
        http.expectOne({ method: 'GET', url: '/api/journal' }).flush({
          entries: [FRIDAY_ENTRY, journalEntry('thursday', '2026-10-01')],
          hasMore: false,
        });
        await settle();

        expect(bookDates()).toEqual(['Friday, 2 October', 'Thursday, 1 October']);
        expect(page.querySelector('#journal-panel .page .text')!.textContent).toBe(
          FRIDAY_ENTRY.text,
        );
      });

      it('opens the book from its button, and Escape closes it with the focus back (JRN-03)', async () => {
        render();
        firstSync();
        await fixture.whenStable();

        journalButton().focus();
        journalButton().click();
        await fixture.whenStable();
        http.expectOne('/api/journal').flush({ entries: [], hasMore: false });
        await settle();
        const dialog = page.querySelector<HTMLElement>('#journal-panel [role="dialog"]')!;
        expect(document.activeElement).toBe(dialog);
        expect(text(dialog)).toContain('Your journal is waiting for its first story.');

        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await fixture.whenStable();
        expect(page.querySelector('app-journal-book')).toBeNull();
        expect(journalButton().getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(journalButton());
      });

      it('shares the space over the planet with the catalogue and the settings', async () => {
        render();
        firstSync();
        await fixture.whenStable();

        journalButton().click();
        await fixture.whenStable();
        http.expectOne('/api/journal').flush({ entries: [], hasMore: false });
        page.querySelector<HTMLButtonElement>('button[aria-controls="catalogue-panel"]')!.click();
        await fixture.whenStable();

        expect(page.querySelector('app-journal-book')).toBeNull();
        expect(page.querySelector('app-catalogue')).not.toBeNull();
      });
    });

    it('cheers a fulfilled want: a hop, the thank-you and the reward, then its receipt (WNT-03 AC1, WNT-04 AC1)', async () => {
      const mira = creatureAt('mira', 5, 5, { want: CLOVER_WANT });
      TestBed.inject(PlanetStore).setSnapshot({ ...mossy, creatures: [mira] });
      render();
      http.expectOne('/api/catalogue').flush(CATALOGUE);
      await fixture.whenStable();

      http.expectOne({ method: 'POST', url: SYNC }).flush({
        snapshot: {
          ...mossy,
          creatures: [{ ...mira, mood: 'cheerful', want: null }],
          inventory: [{ itemType: 'tulip', kind: 'seed', count: 2 }],
        },
        events: [wantFulfilled(mira)],
      });
      await fixture.whenStable();

      const creatures = fixture.debugElement.injector.get(CreatureMeshService);
      expect(creatures.creature('mira')?.cheer?.kind).toBe('hop');
      const reveal = page.querySelector<HTMLElement>('app-reward-reveal [role="dialog"]')!;
      expect(reveal.querySelector('.bubble')?.textContent?.trim()).toBe(THANK_YOU);
      expect(reveal.textContent).toContain('Mira gives you:');
      expect(reveal.textContent).toContain('2 × Tulip seeds');
      const receipts = () =>
        [...page.querySelectorAll('app-receipt-toast .receipt')].map((each) =>
          each.textContent!.trim(),
        );
      expect(receipts()).toEqual([]);

      reveal.querySelector('button')!.click();
      await fixture.whenStable();

      expect(page.querySelector('app-reward-reveal [role="dialog"]')).toBeNull();
      expect(receipts()).toEqual(['+2 Tulip seeds']);
    });
  });

  describe("Pip's tutorial (ONB-01)", () => {
    /** Shows the planet at the tutorial step, with Pip's script served. */
    async function renderAt(tutorialStep: number) {
      TestBed.inject(PlanetStore).setSnapshot({ ...mossy, tutorialStep });
      render();
      http.expectOne('/api/tutorial').flush(TUTORIAL);
      await fixture.whenStable();
    }

    const marked = () =>
      [...page.querySelectorAll('.pip-target')].map((each) => each.tagName.toLowerCase());

    it('greets a new planet beside the planet, which stays in play (AC1)', async () => {
      await renderAt(0);

      expect(page.querySelector('app-pip .text')?.textContent?.trim()).toBe(TUTORIAL.steps[0].text);
      expect(page.querySelector('[aria-modal="true"]')).toBeNull();
      expect(canvas()).not.toBeNull();
      expect(marked()).toEqual([]);
    });

    it.each([
      [1, 'app-planet-view'],
      [2, 'app-inventory-panel'],
      [4, 'app-sky-list'],
      [6, 'app-planet-view'],
    ])('at step %i marks %s, and nothing else', async (step, target) => {
      await renderAt(step);

      expect(marked()).toEqual([target]);
    });

    it('marks the open card on the inspect step', async () => {
      await renderAt(6);

      fixture.debugElement.injector
        .get(PlacementService)
        .openCard({ kind: 'decoration', id: 'd1', x: 10, y: 10 });
      await fixture.whenStable();

      expect(marked()).toEqual(['app-info-card']);
    });

    it('completes the inventory step when the inventory gets the focus', async () => {
      await renderAt(2);

      page
        .querySelector('app-inventory-panel')!
        .dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await fixture.whenStable();

      expect(page.querySelector('app-pip .count')?.textContent?.trim()).toBe('Step 4 of 8');
      await new Promise((resolve) => setTimeout(resolve));
      expect(http.expectOne('/api/planet/tutorial').request.body).toEqual({ step: 3 });
    });
  });
});
