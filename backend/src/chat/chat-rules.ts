// The small rules of a chat (CHT-01..04), kept apart from ChatService so
// they are tested on their own.

/** Every this many of the player's messages to a creature, it keeps one highlight (CHT-02 AC4). */
export const HIGHLIGHT_EVERY = 5;

/** The longest text a chat line may hold, as the chat_messages column allows. */
export const MAX_STORED_CHARS = 1200;

/** Midnight UTC of the day of now: the daily limit counts from there (CHT-03). */
export function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** The player's messages left today; never below 0. */
export function remainingToday(limit: number, used: number): number {
  return Math.max(0, limit - used);
}

/**
 * The time to stamp a new chat line with: now, or 1 ms after the previous
 * line when now is not later, so a creature's chat always reads in order,
 * even when several lines are written within one millisecond.
 */
export function nextStamp(now: Date, previous?: Date): Date {
  if (previous && now.getTime() <= previous.getTime()) {
    return new Date(previous.getTime() + 1);
  }
  return now;
}

/** A message's length in characters as a person counts them: code points, so an emoji is one. */
export function messageLength(text: string): number {
  return [...text].length;
}

/** Whether the player's message with this number (1 for the first) is due a highlight. */
export function isHighlightTurn(userMessageCount: number): boolean {
  return userMessageCount > 0 && userMessageCount % HIGHLIGHT_EVERY === 0;
}

/** The creature's answer in a model reply: the trimmed text, or null when it is empty or too long to store. */
export function parseAnswer(reply: string): string | null {
  const text = reply.trim();
  return text.length > 0 && text.length <= MAX_STORED_CHARS ? text : null;
}
