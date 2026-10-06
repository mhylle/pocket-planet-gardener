import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { MockInstance } from 'vitest';
import { WelcomeBack } from '../../core/models/planet-snapshot';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SyncService } from '../../core/services/sync.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../../testing/fake-motion';
import { MOSSY } from '../../testing/garden-fixtures';
import { FRIDAY_ENTRY, journalEntry } from '../../testing/journal-fixtures';
import { JournalPageComponent } from './journal-page.component';

const SUMMARY: WelcomeBack['summary'] = [{ kind: 'blooms', count: 1, text: '1 plant bloomed' }];

describe('JournalPageComponent', () => {
  let fixture: ComponentFixture<JournalPageComponent>;
  let http: HttpTestingController;
  let focusCanvas: MockInstance<SceneService['focusCanvas']>;
  let page: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [JournalPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        FAKE_MOTION_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    focusCanvas = vi.spyOn(TestBed.inject(SceneService), 'focusCanvas');
  });

  afterEach(() => http.verify());

  async function render() {
    fixture = TestBed.createComponent(JournalPageComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  }

  /** A sync whose response brings what happened while the player was away. */
  async function syncWith(welcomeBack?: WelcomeBack) {
    TestBed.inject(SyncService).syncNow();
    http.expectOne('/api/planet/sync').flush({ snapshot: MOSSY, events: [], welcomeBack });
    await fixture.whenStable();
  }

  const dialog = () => page.querySelector<HTMLElement>('[role="dialog"]');
  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
  const badges = () => [...page.querySelectorAll('.milestones li')];
  const closeButton = () => page.querySelector<HTMLButtonElement>('button.close')!;

  it('shows nothing without a journal entry', async () => {
    await render();

    await syncWith({ summary: SUMMARY });

    expect(dialog()).toBeNull();
    expect(text(page)).toBe('');
  });

  it('opens the entry as a dated, labelled diary page with the focus (JRN-01 AC1, AC2)', async () => {
    await render();

    await syncWith({ summary: SUMMARY, journalEntry: FRIDAY_ENTRY });

    expect(dialog()!.getAttribute('aria-labelledby')).toBe('journal-page-kicker journal-page-date');
    expect(text(page.querySelector('#journal-page-kicker')!)).toBe('From your planet journal');
    expect(text(page.querySelector('#journal-page-date')!)).toBe('Friday, 2 October');
    expect(page.querySelector('.text')!.textContent).toBe(FRIDAY_ENTRY.text);
    expect(document.activeElement).toBe(dialog());
  });

  it('marks each milestone with a star and its words (JRN-03 AC2)', async () => {
    await render();

    await syncWith({ summary: [], journalEntry: FRIDAY_ENTRY });

    expect(page.querySelector('.milestones')!.getAttribute('aria-label')).toBe('Milestones');
    expect(badges().map(text)).toEqual(['★ First bloom: clover', '★ Wigglenut the worm moved in']);
    expect(badges()[0].querySelector('.star')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows no badges for an entry without milestones', async () => {
    await render();

    await syncWith({ summary: [], journalEntry: journalEntry('quiet', '2026-10-01') });

    expect(text(page.querySelector('#journal-page-date')!)).toBe('Thursday, 1 October');
    expect(page.querySelector('.milestones')).toBeNull();
  });

  it('turns in like a page (SET-03)', async () => {
    await render();

    await syncWith({ summary: [], journalEntry: FRIDAY_ENTRY });

    expect(dialog()!.classList.contains('turn')).toBe(true);
  });

  it('opens without the page turn with reduced motion (SET-03)', async () => {
    TestBed.inject(FakeMotionPreference).reduced.set(true);
    await render();

    await syncWith({ summary: [], journalEntry: FRIDAY_ENTRY });

    expect(dialog()).not.toBeNull();
    expect(dialog()!.classList.contains('turn')).toBe(false);
  });

  it('closes on Close and leaves the summary for it to take the focus (JRN-01 AC3)', async () => {
    await render();
    await syncWith({ summary: SUMMARY, journalEntry: FRIDAY_ENTRY });

    closeButton().click();
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(TestBed.inject(PlanetStore).welcomeBack()).toEqual({ summary: SUMMARY });
    expect(focusCanvas).not.toHaveBeenCalled();
  });

  it('closes on Escape and gives the focus back to the planet when there is no summary', async () => {
    await render();
    await syncWith({ summary: [], journalEntry: FRIDAY_ENTRY });

    closeButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(TestBed.inject(PlanetStore).welcomeBack()).toBeNull();
    expect(focusCanvas).toHaveBeenCalledOnce();
  });

  it('takes the focus back when the summary under it is dismissed', async () => {
    await render();
    await syncWith({ summary: SUMMARY, journalEntry: FRIDAY_ENTRY });
    closeButton().focus();

    TestBed.inject(PlanetStore).dismissWelcomeBack();
    await fixture.whenStable();

    expect(document.activeElement).toBe(dialog());
  });
});
