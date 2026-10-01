import { Component, inject, signal } from '@angular/core';
import { errorMessage, hasStatus } from '../../core/helpers/error-message';
import { PlanetService } from '../../core/services/planet.service';
import { PlanetNameFormComponent } from '../planet-name-form/planet-name-form.component';

export const UNKNOWN_CODE_MESSAGE =
  "We couldn't find a planet with that code. Check the letters and try again.";

/** First screen without a planet: name a new one, or open one with its code (ACC-01, ACC-02). */
@Component({
  selector: 'app-create-planet',
  imports: [PlanetNameFormComponent],
  templateUrl: './create-planet.component.html',
  styleUrl: './create-planet.component.scss',
})
export class CreatePlanetComponent {
  private readonly planets = inject(PlanetService);

  protected readonly notice = this.planets.notice;
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly opening = signal(false);
  protected readonly codeError = signal<string | null>(null);

  protected async create(name: string): Promise<void> {
    this.creating.set(true);
    this.createError.set(null);
    try {
      await this.planets.create(name);
    } catch (error) {
      this.createError.set(errorMessage(error));
    } finally {
      this.creating.set(false);
    }
  }

  protected async openByCode(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.code().trim() || this.opening()) {
      return;
    }
    this.opening.set(true);
    this.codeError.set(null);
    try {
      await this.planets.openByCode(this.code());
    } catch (error) {
      this.codeError.set(hasStatus(error, 404) ? UNKNOWN_CODE_MESSAGE : errorMessage(error));
    } finally {
      this.opening.set(false);
    }
  }
}
