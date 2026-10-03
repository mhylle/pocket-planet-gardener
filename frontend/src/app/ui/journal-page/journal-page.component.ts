import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { diaryDate } from '../../core/helpers/diary-date';
import { prefersReducedMotion } from '../../core/helpers/reduced-motion';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SceneService } from '../../scene/scene.service';
import { JournalEntryComponent } from '../journal-entry/journal-entry.component';

/**
 * The diary page written while the player was away, dated and with its milestones (JRN-01
 * AC1, AC2). It opens above the welcome-back summary with a page turn, or without one under
 * reduced motion (SET-03), and takes the focus. Close or Escape puts it away, to be found again
 * in the journal (AC3); the focus goes to the summary below, or to the planet when there is none.
 */
@Component({
  selector: 'app-journal-page',
  imports: [JournalEntryComponent],
  templateUrl: './journal-page.component.html',
  styleUrl: './journal-page.component.scss',
  host: { '(keydown.escape)': 'close()' },
})
export class JournalPageComponent {
  private readonly store = inject(PlanetStore);
  private readonly scene = inject(SceneService);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  protected readonly entry = computed(() => this.store.welcomeBack()?.journalEntry ?? null);
  protected readonly date = computed(() => {
    const entry = this.entry();
    return entry ? diaryDate(entry.createdAt) : '';
  });
  protected readonly still = prefersReducedMotion();

  constructor() {
    // Runs when a page opens, or the summary under it goes, once it is drawn.
    afterRenderEffect(() => {
      if (this.store.welcomeBack()?.journalEntry) {
        this.dialog()?.nativeElement.focus();
      }
    });
  }

  protected close(): void {
    this.store.dismissJournalEntry();
    // The summary takes the focus itself when it is still there.
    if (!this.store.welcomeBack()) {
      this.scene.focusCanvas();
    }
  }
}
