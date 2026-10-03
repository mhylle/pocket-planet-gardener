const PARTS = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * A journal page's date the way a diary heads it, such as "Friday, 2 October" (JRN-01 AC2), on
 * the player's own calendar.
 */
export function diaryDate(iso: string): string {
  const parts = PARTS.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((each) => each.type === type)?.value ?? '';
  return `${part('weekday')}, ${part('day')} ${part('month')}`;
}
