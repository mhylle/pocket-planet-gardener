/** Who wrote a chat line: the player, the creature, or the game itself (AIB-03 AC2). */
export type ChatRole = 'user' | 'creature' | 'notice';

/** One line of a creature's chat. */
export interface ChatMessageDto {
  id: string;
  role: ChatRole;
  text: string;
  /** ISO timestamp. */
  createdAt: string;
  /** For the creature's lines: written by the AI, a napping fallback, or a scripted line. */
  source?: 'ai' | 'fallback' | 'scripted';
  /** Notices only: where real people can help. */
  link?: { label: string; url: string };
}

/** A page of a creature's chat, oldest first, with today's allowance and its greeting. */
export interface ChatPageDto {
  messages: ChatMessageDto[];
  /** There are older messages before this page (CHT-04 AC1). */
  hasMore: boolean;
  /** Messages the player may still send today, across all creatures (CHT-03). */
  remaining: number;
  /** A scripted hello in the creature's speaking style; not stored (CHT-01 AC1). */
  greeting: string;
}

/** What a sent message brought: the player's line, an optional notice and the answer. */
export interface ChatReplyDto {
  messages: ChatMessageDto[];
  remaining: number;
  /** Today's chats are used up; the only message is the creature's sleepy line (CHT-03 AC1). */
  limitReached: boolean;
}
