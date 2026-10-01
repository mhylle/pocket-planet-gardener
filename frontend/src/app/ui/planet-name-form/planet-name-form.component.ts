import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { GameConfigService } from '../../core/services/game-config.service';

let nextId = 0;

/**
 * A planet name field with a live length counter, used for both creating and renaming so the
 * rules are the same (ACC-02 AC1, AC4). Length counts code points after trimming, as the server
 * does, so an emoji counts as one. The parent sends the request and passes back any error.
 */
@Component({
  selector: 'app-planet-name-form',
  templateUrl: './planet-name-form.component.html',
  styleUrl: './planet-name-form.component.scss',
})
export class PlanetNameFormComponent {
  readonly label = input.required<string>();
  readonly submitLabel = input.required<string>();
  readonly initialName = input('');
  readonly error = input<string | null>(null);
  readonly busy = input(false);
  /** Emits the trimmed name. */
  readonly save = output<string>();

  private readonly config = inject(GameConfigService).config;

  protected readonly fieldId = `planet-name-${++nextId}`;
  protected readonly name = linkedSignal(() => this.initialName());
  protected readonly length = computed(() => [...this.name().trim()].length);
  protected readonly min = computed(() => this.config().planetNameMin);
  protected readonly max = computed(() => this.config().planetNameMax);
  protected readonly valid = computed(
    () => this.length() >= this.min() && this.length() <= this.max(),
  );

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.valid() && !this.busy()) {
      this.save.emit(this.name().trim());
    }
  }
}
