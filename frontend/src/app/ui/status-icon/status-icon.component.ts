import { Component, input } from '@angular/core';
import { StatusIcon } from '../../core/helpers/status-text';

/**
 * The small line drawing next to a status (SET-04). The status's words sit beside it, so
 * screen readers skip it.
 */
@Component({
  selector: 'app-status-icon',
  templateUrl: './status-icon.component.html',
  styleUrl: './status-icon.component.scss',
})
export class StatusIconComponent {
  readonly icon = input.required<StatusIcon>();
}
