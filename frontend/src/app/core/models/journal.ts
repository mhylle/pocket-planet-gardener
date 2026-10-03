/** An important moment an entry covers, such as a first bloom or an arrival (JRN-03 AC2). */
export interface JournalMilestoneDto {
  type: string;
  /** Such as "First bloom: clover" or "Wigglenut the worm moved in". */
  label: string;
  /** ISO timestamp. */
  occurredAt: string;
}

/** One diary page about a stretch of time the player was away (JRN-01). */
export interface JournalEntryDto {
  id: string;
  text: string;
  /** Written by the AI, or from a template when the AI was unavailable (JRN-02 AC4). */
  source: 'ai' | 'template';
  /** ISO timestamp; the page's date. */
  createdAt: string;
  /** ISO timestamps of the stretch the entry tells about. */
  coversFrom: string;
  coversTo: string;
  milestones: JournalMilestoneDto[];
}

/** A page of GET /api/journal, newest first. */
export interface JournalPageDto {
  entries: JournalEntryDto[];
  /** There are older entries before this page (JRN-03 AC1). */
  hasMore: boolean;
}
