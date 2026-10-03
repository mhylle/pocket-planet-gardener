import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlanetSnapshotDto, WelcomeBack } from '../../core/models/planet-snapshot';
import { ChatService } from '../../core/services/chat.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
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
  wantFulfilled,
} from '../../testing/garden-fixtures';
import { FRIDAY_ENTRY, journalEntry } from '../../testing/journal-fixtures';
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

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PlanetPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(mossy.id);
    TestBed.inject(ViewStateService).show('planet');
  });

  afterEach(() => {
    // The page asks for the catalogue for the inventory names and syncs once the planet is
    // shown; the specs that do not need these leave them unanswered.
    http.match('/api/catalogue');
    http.match('/api/planet/sync');
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

  it('puts the clouds and the sun next after the canvas in the Tab order (GRD-02 AC4)', async () => {
    TestBed.inject(PlanetStore).setSnapshot(mossy);

    render();
    await fixture.whenStable();

    const tabStops = [...page.querySelectorAll('[tabindex="0"], button, input')];
    const next = tabStops[tabStops.indexOf(canvas()!) + 1];
    expect(next.getAttribute('role')).toBe('option');
    expect(next.closest('app-sky-list')).not.toBeNull();
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
        http
          .expectOne({ method: 'GET', url: '/api/journal' })
          .flush({
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
});
