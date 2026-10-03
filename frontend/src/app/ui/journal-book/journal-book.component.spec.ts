import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JournalEntryDto } from '../../core/models/journal';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { FRIDAY_ENTRY, journalEntry } from '../../testing/journal-fixtures';
import { JournalBookComponent } from './journal-book.component';

const THURSDAY = journalEntry('thursday', '2026-10-01', { text: 'A quiet, rainy day.' });
const MONDAY = journalEntry('monday', '2026-09-28', {
  milestones: [
    {
      type: 'creature-arrived',
      label: 'Mira the moth moved in',
      occurredAt: '2026-09-28T11:00:00.000Z',
    },
  ],
});
const SUNDAY = journalEntry('sunday', '2026-09-27');

describe('JournalBookComponent', () => {
  let fixture: ComponentFixture<JournalBookComponent>;
  let http: HttpTestingController;
  let page: HTMLElement;
  let opener: HTMLButtonElement;
  let closed: number;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [JournalBookComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetIdentityService).set('planet-1');
    // Stands in for the Journal button, which has the focus when the book opens.
    opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    fixture = TestBed.createComponent(JournalBookComponent);
    page = fixture.nativeElement;
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    opener.remove();
  });

  /** Answers the book's request for a page of entries, then waits for the re-render. */
  async function answer(url: string, entries: JournalEntryDto[], hasMore: boolean) {
    http.expectOne({ method: 'GET', url }).flush({ entries, hasMore });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const dialog = () => page.querySelector<HTMLElement>('[role="dialog"]')!;
  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
  const sheets = () => [...page.querySelectorAll<HTMLElement>('.page')];
  const dates = () => sheets().map((sheet) => text(sheet.querySelector('h4')!));
  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((each) => text(each) === label);

  it('is a labelled dialog that takes the focus and loads the newest entries', async () => {
    expect(dialog().getAttribute('aria-labelledby')).toBe('journal-title');
    expect(text(page.querySelector('#journal-title')!)).toBe('Journal');
    expect(document.activeElement).toBe(dialog());
    expect(text(page.querySelector('.hint')!)).toBe('Opening your journal…');

    await answer('/api/journal', [FRIDAY_ENTRY, THURSDAY], false);

    expect(page.querySelector('.hint')).toBeNull();
  });

  it('shows every entry as a dated page, newest first (JRN-03 AC1)', async () => {
    await answer('/api/journal', [FRIDAY_ENTRY, THURSDAY], false);

    expect(dates()).toEqual(['Friday, 2 October', 'Thursday, 1 October']);
    expect(sheets()[1].querySelector('.text')!.textContent).toBe('A quiet, rainy day.');
    expect(sheets()[0].getAttribute('aria-labelledby')).toBe('journal-date-friday');
    expect(button('Older entries')).toBeUndefined();
  });

  it('marks the pages with milestones with a star and its words (JRN-03 AC2)', async () => {
    await answer('/api/journal', [FRIDAY_ENTRY, THURSDAY], false);

    expect([...sheets()[0].querySelectorAll('.milestones li')].map(text)).toEqual([
      '★ First bloom: clover',
      '★ Wigglenut the worm moved in',
    ]);
    expect(sheets()[1].querySelector('.milestones')).toBeNull();
  });

  it('adds the entries before the oldest shown on "Older entries", while there are more (JRN-03 AC1)', async () => {
    await answer('/api/journal', [FRIDAY_ENTRY, THURSDAY], true);

    button('Older entries')!.click();
    await answer('/api/journal?before=2026-10-01T12%3A00%3A00.000Z', [MONDAY], true);

    expect(dates()).toEqual(['Friday, 2 October', 'Thursday, 1 October', 'Monday, 28 September']);
    expect(document.activeElement).toBe(sheets()[2]);
    expect(text(sheets()[2].querySelector('.milestones')!)).toBe('★ Mira the moth moved in');

    button('Older entries')!.click();
    await answer('/api/journal?before=2026-09-28T12%3A00%3A00.000Z', [SUNDAY], false);

    expect(dates()).toHaveLength(4);
    expect(dates()[3]).toBe('Sunday, 27 September');
    expect(document.activeElement).toBe(sheets()[3]);
    expect(button('Older entries')).toBeUndefined();
  });

  it('asks only once while older entries are on their way', async () => {
    await answer('/api/journal', [FRIDAY_ENTRY], true);

    button('Older entries')!.click();
    button('Older entries')!.click();

    await answer('/api/journal?before=2026-10-02T12%3A00%3A00.000Z', [THURSDAY], false);
    expect(dates()).toHaveLength(2);
  });

  it('says the journal is waiting when there are no entries yet', async () => {
    await answer('/api/journal', [], false);

    expect(sheets()).toHaveLength(0);
    expect(text(page.querySelector('.empty')!)).toBe(
      'Your journal is waiting for its first story.',
    );
  });

  it('offers a retry when the journal cannot be reached', async () => {
    http
      .expectOne('/api/journal')
      .flush({ message: 'down' }, { status: 500, statusText: 'Server Error' });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(text(page.querySelector('[role="alert"]')!)).toContain(
      "We couldn't reach your journal just now.",
    );
    expect(page.querySelector('.empty')).toBeNull();

    button('Try again')!.click();
    await answer('/api/journal', [FRIDAY_ENTRY], false);

    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(dates()).toEqual(['Friday, 2 October']);
  });

  it('closes on Close or Escape, and the focus goes back to where it was', async () => {
    await answer('/api/journal', [FRIDAY_ENTRY], false);

    button('Close')!.click();
    expect(closed).toBe(1);

    sheets()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(2);

    fixture.destroy();
    expect(document.activeElement).toBe(opener);
  });
});
