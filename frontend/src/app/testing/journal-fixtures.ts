import { JournalEntryDto } from '../core/models/journal';

/** Test data shared by the journal specs. */

/** A journal entry written at noon UTC on the given day, so its date is the same everywhere. */
export function journalEntry(
  id: string,
  day: string,
  changes: Partial<JournalEntryDto> = {},
): JournalEntryDto {
  return {
    id,
    text: `Entry ${id}.`,
    source: 'ai',
    createdAt: `${day}T12:00:00.000Z`,
    coversFrom: `${day}T06:00:00.000Z`,
    coversTo: `${day}T12:00:00.000Z`,
    milestones: [],
    ...changes,
  };
}

/** The page the player comes back to on Friday, with a first bloom and an arrival. */
export const FRIDAY_ENTRY = journalEntry('friday', '2026-10-02', {
  text: 'Dear diary, the clover finally bloomed!\n\nWigglenut moved in and approved of the soil.',
  milestones: [
    { type: 'first-bloom', label: 'First bloom: clover', occurredAt: '2026-10-02T09:00:00.000Z' },
    {
      type: 'creature-arrived',
      label: 'Wigglenut the worm moved in',
      occurredAt: '2026-10-02T10:00:00.000Z',
    },
  ],
});
