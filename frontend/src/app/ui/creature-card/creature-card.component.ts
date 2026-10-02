import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { NO_WISH_TEXT, StatusText, moodText } from '../../core/helpers/status-text';
import { CreatureDto } from '../../core/models/creature';
import { CatalogueService } from '../../core/services/catalogue.service';
import { StatusIconComponent } from '../status-icon/status-icon.component';

/**
 * What the info card shows of a creature under its name (NAV-03 AC2, CRT-03 AC1): its
 * species, the one-line summary of its personality, its quirk, and its mood and want as icon
 * and words (SET-04). The want slot says there is no wish until the creature has one. A pinned
 * card also has "More", which shows its traits and backstory; it starts closed for each
 * creature.
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

  protected readonly species = computed(() => this.catalogue.name(this.creature().species));
  protected readonly statuses = computed<StatusText[]>(() => {
    const { mood, wistful } = this.creature();
    return [moodText(mood, wistful), NO_WISH_TEXT];
  });
  protected readonly traits = computed(() => this.creature().traits.join(', '));
  protected readonly expanded = linkedSignal({
    source: () => this.creature().id,
    computation: () => false,
  });
}
