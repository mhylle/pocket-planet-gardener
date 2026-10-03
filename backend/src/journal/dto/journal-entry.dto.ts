import type { JournalSource } from '../journal-entry.entity';

/** An important moment marked on a journal page (JRN-03 AC2). */
export interface JournalMilestoneDto {
  // The event type, such as plant-bloomed.
  type: string;
  // Such as "First bloom: clover" or "Wigglenut the worm moved in".
  label: string;
  // ISO timestamp.
  occurredAt: string;
}

/** One journal page as the diary page and the book show it (JRN-01, JRN-03). */
export interface JournalEntryDto {
  id: string;
  text: string;
  source: JournalSource;
  // ISO timestamps. The page tells the story of (coversFrom, coversTo].
  createdAt: string;
  coversFrom: string;
  coversTo: string;
  // The planet's milestone events in that span, oldest first.
  milestones: JournalMilestoneDto[];
}

/** GET /api/journal: one page of the book, newest entry first (JRN-03 AC1). */
export interface JournalPageDto {
  entries: JournalEntryDto[];
  // Older entries exist before this page.
  hasMore: boolean;
}
