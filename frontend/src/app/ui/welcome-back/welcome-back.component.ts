import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { SurfacePoint } from '../../core/helpers/surface-coords';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { SceneService } from '../../scene/scene.service';

/**
 * What changed while the player was away, such as "3 plants bloomed · 1 new creature"
 * (TIM-03 AC1). A line with a place to show is a button that turns the planet to it, at once
 * under reduced motion (AC3). The summary takes the focus when it opens, unless the journal
 * page above it has it (JRN-01 AC1); then it takes the focus when the page closes. Dismiss or
 * Escape hides it and gives the focus back to the planet, or to the journal page when that is
 * still open. A quiet day brings a journal page with no lines, and then the summary stays hidden.
 */
@Component({
  selector: 'app-welcome-back',
  templateUrl: './welcome-back.component.html',
  styleUrl: './welcome-back.component.scss',
  host: { '(keydown.escape)': 'dismiss()' },
})
export class WelcomeBackComponent {
  private readonly store = inject(PlanetStore);
  private readonly camera = inject(CameraControlsService);
  private readonly scene = inject(SceneService);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  protected readonly lines = computed(() => this.store.welcomeBack()?.summary ?? []);

  constructor() {
    // Runs when a summary opens, a newer one replaces it, or the journal page above it closes,
    // once it is drawn.
    afterRenderEffect(() => {
      const welcomeBack = this.store.welcomeBack();
      if (welcomeBack?.summary.length && !welcomeBack.journalEntry) {
        this.dialog()?.nativeElement.focus();
      }
    });
  }

  protected show(focus: SurfacePoint): void {
    this.camera.focusOn(focus, { instant: this.camera.reducedMotion });
  }

  protected dismiss(): void {
    this.store.dismissWelcomeBack();
    // The journal page takes the focus itself when it is still open.
    if (!this.store.welcomeBack()) {
      this.scene.focusCanvas();
    }
  }
}
