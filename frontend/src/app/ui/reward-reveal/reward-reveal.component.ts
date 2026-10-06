import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { MotionPreferenceService } from '../../core/services/motion-preference.service';
import { RewardRevealService } from '../../core/services/reward-reveal.service';
import { SceneService } from '../../scene/scene.service';

/**
 * Shows what a creature hands over before it goes into the inventory (WNT-04 AC1): for a
 * fulfilled want, the creature's thank-you in a speech bubble and "Mira gives you: 2 × Tulip
 * seeds" (WNT-03 AC1); for an overjoyed creature's present, "Mira has a present for you: …"
 * (CRT-04 AC2). It hops in, or only fades in when motion is reduced (SET-03). It takes the
 * focus, and gives it back to where it was once the last one is put away.
 */
@Component({
  selector: 'app-reward-reveal',
  templateUrl: './reward-reveal.component.html',
  styleUrl: './reward-reveal.component.scss',
})
export class RewardRevealComponent {
  private readonly reveals = inject(RewardRevealService);
  private readonly scene = inject(SceneService);
  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('done');
  /** Where the focus was before the first reveal took it. */
  private returnFocus: Element | null = null;

  /** The current reveal as a list of one, so each new reveal is drawn, and hops, afresh. */
  protected readonly shown = computed(() => {
    const reveal = this.reveals.current();
    return reveal ? [reveal] : [];
  });
  protected readonly still = inject(MotionPreferenceService).reduced;

  constructor() {
    // Runs once each reveal's button is drawn.
    afterRenderEffect(() => {
      const button = this.button()?.nativeElement;
      if (button) {
        this.returnFocus ??= document.activeElement;
        button.focus();
      }
    });
  }

  protected dismiss(): void {
    this.reveals.dismiss();
    if (this.reveals.current()) {
      return;
    }
    const back = this.returnFocus;
    this.returnFocus = null;
    if (back instanceof HTMLElement && back.isConnected && back !== document.body) {
      back.focus();
    } else {
      this.scene.focusCanvas();
    }
  }
}
