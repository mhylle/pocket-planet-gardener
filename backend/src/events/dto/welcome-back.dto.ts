import type { JournalEntryDto } from '../../journal/dto/journal-entry.dto';
import type { SummaryLine } from '../event-summary';

/**
 * What a sync adds for a returning player: the news (TIM-03) and, after a
 * long enough absence, a new journal page shown above it (JRN-01). Sent when
 * either has something; a quiet day's page comes with an empty summary.
 */
export interface WelcomeBackDto {
  // What changed while the player was away; may be empty only beside a journal entry.
  summary: SummaryLine[];
  journalEntry?: JournalEntryDto;
}
