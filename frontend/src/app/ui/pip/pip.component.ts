import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { TutorialService } from '../../core/services/tutorial.service';
import { SceneService } from '../../scene/scene.service';
import { PipCloudComponent } from '../pip-cloud/pip-cloud.component';

export const PIP_WAITING_LINE =
  'Pip is here whenever you need help. Choose Ask Pip to start again.';

/**
 * Pip, a small scripted cloud, guides a new player step by step (ONB-01). A speech bubble in
 * a corner says what to do next and which step it is, and leaves the game free to play. Each
 * new step is read out. Once the tutorial is done Pip waits as a small help button that starts
 * it again (AC3). Pip bobs gently unless motion is reduced (SET-03).
 */
@Component({
  selector: 'app-pip',
  imports: [PipCloudComponent],
  templateUrl: './pip.component.html',
  styleUrl: './pip.component.scss',
})
export class PipComponent {
  protected readonly tutorial = inject(TutorialService);
  private readonly scene = inject(SceneService);
  private readonly injector = inject(Injector);
  private readonly action = viewChild<ElementRef<HTMLButtonElement>>('action');

  /** The step shown, counted from 1. */
  protected readonly number = computed(() => (this.tutorial.step() ?? 0) + 1);
  /** What the live region reads out: each new step, and Pip waiting once it is done. */
  protected readonly announcement = computed(() => {
    const step = this.tutorial.current();
    if (step) {
      return `Pip says: ${step.text} Step ${this.number()} of ${this.tutorial.steps().length}.`;
    }
    return this.tutorial.finished() ? PIP_WAITING_LINE : '';
  });

  /** One of Pip's own steps is done; the keyboard goes back to the planet to play on. */
  protected done(id: 'welcome' | 'goodbye'): void {
    this.tutorial.complete(id);
    this.scene.focusCanvas();
  }

  /** Starts again, with the keyboard on the welcome's button. */
  protected restart(): void {
    this.tutorial.restart();
    afterNextRender(() => this.action()?.nativeElement.focus(), { injector: this.injector });
  }
}
