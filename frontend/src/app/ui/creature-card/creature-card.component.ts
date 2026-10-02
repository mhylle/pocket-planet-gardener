import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { errorMessage, hasStatus } from '../../core/helpers/error-message';
import { NO_WISH_TEXT, StatusText, moodText } from '../../core/helpers/status-text';
import { CreatureDto } from '../../core/models/creature';
import { CatalogueService } from '../../core/services/catalogue.service';
import { SyncService } from '../../core/services/sync.service';
import { StatusIconComponent } from '../status-icon/status-icon.component';

/**
 * What the info card shows of a creature under its name (NAV-03 AC2, CRT-03 AC1): its
 * species, the one-line summary of its personality, its quirk, and its mood and want as icon
 * and words (SET-04). The want is in the creature's own voice with what it needs in plain
 * words beneath (WNT-01 AC3, WNT-02 AC2); without one, the slot says there is no wish. A
 * pinned card also has "More", which shows its traits and backstory and starts closed for
 * each creature, and "Maybe later" for a want, which sets it aside with a friendly word and no
 * change of mood (WNT-05).
 */
@Component({
  selector: 'app-creature-card',
  imports: [StatusIconComponent],
  templateUrl: './creature-card.component.html',
  styleUrl: './creature-card.component.scss',
})
export class CreatureCardComponent {
  readonly creature = input.required<CreatureDto>();
  /** Opened by a tap; only then can the rest be read. */
  readonly pinned = input(false);

  private readonly catalogue = inject(CatalogueService);
  private readonly sync = inject(SyncService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly species = computed(() => this.catalogue.name(this.creature().species));
  protected readonly mood = computed<StatusText>(() => {
    const { mood, wistful } = this.creature();
    return moodText(mood, wistful);
  });
  protected readonly noWish = NO_WISH_TEXT;
  protected readonly traits = computed(() => this.creature().traits.join(', '));
  /** Changes only for another creature, not for each new snapshot of this one. */
  private readonly creatureId = computed(() => this.creature().id);
  protected readonly expanded = linkedSignal({
    source: this.creatureId,
    computation: () => false,
  });
  /** The line after "Maybe later": the friendly answer, or why it did not go through. */
  protected readonly note = linkedSignal<string, string | null>({
    source: this.creatureId,
    computation: () => null,
  });
  protected readonly saving = signal(false);

  protected async maybeLater(wantId: string): Promise<void> {
    const { name } = this.creature();
    this.saving.set(true);
    try {
      await this.sync.send({
        method: 'POST',
        path: `/wants/${encodeURIComponent(wantId)}/maybe-later`,
        body: {},
      });
      this.note.set(`No rush — ${name} will think of something else.`);
      // The button has gone with the want; "More" keeps the focus in the card.
      this.host.nativeElement.querySelector('button')?.focus();
    } catch (error) {
      // A conflict has its own banner, and a closed planet needs no word.
      if (error instanceof HttpErrorResponse && !hasStatus(error, 409)) {
        this.note.set(errorMessage(error));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
