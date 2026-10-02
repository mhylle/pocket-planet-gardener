import type { ChatRole, ChatSource } from '../chat-message.entity';

/** One chat line as the chat panel shows it. */
export interface ChatMessageDto {
  id: string;
  role: ChatRole;
  text: string;
  // ISO timestamp.
  createdAt: string;
  // Absent on the player's own messages.
  source?: ChatSource;
  // Notices only: where real people can help (AIB-03 AC2).
  link?: { label: string; url: string };
}

/** GET /api/creatures/:id/chat: one page of history, oldest first. */
export interface ChatHistoryDto {
  messages: ChatMessageDto[];
  // Older messages exist before this page.
  hasMore: boolean;
  // The player's messages left today, across all creatures (CHT-03 AC2).
  remaining: number;
  // A scripted hello in the creature's speaking style; not stored (CHT-01 AC1).
  greeting: string;
}

/** POST /api/creatures/:id/chat: the new messages, in order. */
export interface ChatSendResultDto {
  // The player's message, an optional notice, the creature's answer; at the
  // daily limit only the creature's sleepy line, which is not stored.
  messages: ChatMessageDto[];
  remaining: number;
  // This message was over the daily limit, so nothing was stored (CHT-03 AC1).
  limitReached: boolean;
}
