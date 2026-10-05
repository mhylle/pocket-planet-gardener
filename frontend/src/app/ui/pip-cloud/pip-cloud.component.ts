import { Component } from '@angular/core';

/**
 * Pip's picture: a small white cloud with a face, hidden from screen readers. Sized by the
 * host's font size; the class "bob" makes it float gently unless the device asks for less
 * motion.
 */
@Component({
  selector: 'app-pip-cloud',
  templateUrl: './pip-cloud.component.html',
  styleUrl: './pip-cloud.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class PipCloudComponent {}
