import { Component, inject } from '@angular/core';
import { prefersReducedMotion } from '../../core/helpers/reduced-motion';
import { CELEBRATION_MS, CelebrationService } from '../../core/services/celebration.service';

/**
 * "New in your catalogue: Tulip" with a small burst of sparkles (ITM-04 AC3). With reduced
 * motion it only fades in and out, and the sparkles stand still (SET-03).
 */
@Component({
  selector: 'app-celebration',
  templateUrl: './celebration.component.html',
  styleUrl: './celebration.component.scss',
  host: { '[style.--celebration-ms]': 'duration' },
})
export class CelebrationComponent {
  protected readonly celebrations = inject(CelebrationService).celebrations;
  protected readonly still = prefersReducedMotion();
  protected readonly duration = `${CELEBRATION_MS}ms`;
  /** Where each sparkle flies to, as an angle in degrees. */
  protected readonly sparkles = [0, 60, 120, 180, 240, 300];
}
