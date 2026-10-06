import { Component, inject } from '@angular/core';
import { MotionPreferenceService } from '../../core/services/motion-preference.service';

/**
 * Pip's picture: a small white cloud with a face, hidden from screen readers. Sized by the
 * host's font size; the class "bob" makes it float gently unless motion is reduced (SET-03).
 */
@Component({
  selector: 'app-pip-cloud',
  templateUrl: './pip-cloud.component.html',
  styleUrl: './pip-cloud.component.scss',
  host: { 'aria-hidden': 'true', '[class.still]': 'still()' },
})
export class PipCloudComponent {
  protected readonly still = inject(MotionPreferenceService).reduced;
}
