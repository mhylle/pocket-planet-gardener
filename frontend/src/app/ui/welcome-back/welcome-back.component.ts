import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { SurfacePoint } from '../../core/helpers/surface-coords';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { SceneService } from '../../scene/scene.service';

/**
 * What changed while the player was away, such as "3 plants bloomed · 1 new creature"
 * (TIM-03 AC1). A line with a place to show is a button that turns the planet to it, at once
 * under reduced motion (AC3). The summary takes the focus when it opens; Dismiss or Escape
 * hides it and gives the focus back to the planet.
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

  protected readonly welcomeBack = this.store.welcomeBack;

  constructor() {
    // Runs when a summary opens, or a newer one replaces it, once it is drawn.
    afterRenderEffect(() => {
      if (this.welcomeBack()) {
        this.dialog()?.nativeElement.focus();
      }
    });
  }

  protected show(focus: SurfacePoint): void {
    this.camera.focusOn(focus, { instant: this.camera.reducedMotion });
  }

  protected dismiss(): void {
    this.store.dismissWelcomeBack();
    this.scene.focusCanvas();
  }
}
