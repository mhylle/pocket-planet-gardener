import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { diaryDate } from '../../core/helpers/diary-date';
import { JournalEntryDto } from '../../core/models/journal';
import { JournalService } from '../../core/services/journal.service';
import { JournalEntryComponent } from '../journal-entry/journal-entry.component';

/**
 * The planet journal as a book (JRN-03): every entry, newest first, each a dated page with a
 * star badge for each milestone so important moments are easy to find (AC2). A page put away on
 * return can be read again here (JRN-01 AC3). It loads the newest entries when it opens, and
 * "Older entries" adds the ones before them while there are more (AC1); the first page it adds
 * then takes the focus. The book takes the focus when it opens; Escape or Close closes it, and
 * the focus goes back to where it was.
 */
@Component({
  selector: 'app-journal-book',
  imports: [JournalEntryComponent],
  templateUrl: './journal-book.component.html',
  styleUrl: './journal-book.component.scss',
  host: { '(keydown.escape)': 'closed.emit()' },
})
export class JournalBookComponent {
  readonly closed = output<void>();

  private readonly journal = inject(JournalService);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');
  private readonly sheets = viewChildren<ElementRef<HTMLElement>>('sheet');
  private readonly entries = signal<JournalEntryDto[]>([]);

  /** Each entry with its date heading, newest first. */
  protected readonly pages = computed(() =>
    this.entries().map((entry) => ({ entry, date: diaryDate(entry.createdAt) })),
  );
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    const returnTo = document.activeElement as HTMLElement | null;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => this.dialog().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => {
      // Only when the focus was in here (or went with it), so a click elsewhere keeps its own.
      const focused = document.activeElement;
      if (!focused || focused === document.body || host.contains(focused)) {
        returnTo?.focus();
      }
    });
    void this.load();
  }

  /** Loads the newest entries, or the ones written before the oldest shown. */
  protected async load(): Promise<void> {
    if (this.loading()) {
      return;
    }
    const shown = this.entries();
    this.loading.set(true);
    this.failed.set(false);
    try {
      const page = await this.journal.page(shown.at(-1)?.createdAt);
      this.entries.set([...shown, ...page.entries]);
      this.hasMore.set(page.hasMore);
      if (shown.length) {
        // The button may be gone now, so the reader goes on from the first page it added.
        afterNextRender(() => this.sheets()[shown.length]?.nativeElement.focus(), {
          injector: this.injector,
        });
      }
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
