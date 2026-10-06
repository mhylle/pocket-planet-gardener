import { Component, inject } from '@angular/core';
import { CELEBRATION_MS, CelebrationService } from '../../core/services/celebration.service';
import { MotionPreferenceService } from '../../core/services/motion-preference.service';

/**
 * "New in your catalogue: Tulip" (ITM-04 AC3) or "Mira the moth moved in!" (CRT-01 AC1) with a
 * small burst of sparkles. With reduced motion it only fades in and out, and the sparkles
 * stand still (SET-03).
 */
@Component({
  selector: 'app-celebration',
  templateUrl: './celebration.component.html',
  styleUrl: './celebration.component.scss',
  host: { '[style.--celebration-ms]': 'duration' },
})
export class CelebrationComponent {
  protected readonly celebrations = inject(CelebrationService).celebrations;
  protected readonly still = inject(MotionPreferenceService).reduced;
  protected readonly duration = `${CELEBRATION_MS}ms`;
  /** Where each sparkle flies to, as an angle in degrees. */
  protected readonly sparkles = [0, 60, 120, 180, 240, 300];
}
