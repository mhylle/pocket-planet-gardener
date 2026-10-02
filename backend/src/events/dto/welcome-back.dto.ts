import type { SummaryLine } from '../event-summary';

/** What a sync adds for a returning player (TIM-03); Task 14.3 adds the journal entry. */
export interface WelcomeBackDto {
  // What changed while the player was away; never empty.
  summary: SummaryLine[];
}
