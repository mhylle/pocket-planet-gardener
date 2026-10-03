import { Component, input } from '@angular/core';
import { JournalEntryDto } from '../../core/models/journal';

/**
 * The words of a journal entry and a star badge for each important moment it covers, such as
 * "First bloom: clover", so those pages are easy to find (JRN-03 AC2). Its date heading
 * belongs to the page or book around it.
 */
@Component({
  selector: 'app-journal-entry',
  templateUrl: './journal-entry.component.html',
  styleUrl: './journal-entry.component.scss',
})
export class JournalEntryComponent {
  readonly entry = input.required<JournalEntryDto>();
}
