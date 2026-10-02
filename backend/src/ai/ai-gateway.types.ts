import type { ChatMessage } from './ai.types';
import type { TextLimits } from './content-rules';

/** Why the gateway used the fallback instead of the model's answer. */
export type AiFallbackReason =
  'disabled' | 'budget' | 'timeout' | 'error' | 'invalid';

/**
 * One request for AI content: the conversation to send, how to read and
 * check the reply, and what to use instead (D-4, AIB-05).
 */
export interface AiRequest<T> {
  // Logged with the usage row, such as identity or chat; at most 32 characters.
  feature: string;
  planetId?: string;
  messages: ChatMessage[];
  /** The value in the reply, or null when it has the wrong form; see extractJson. */
  parse(text: string): T | null;
  /** Problems the content rules cannot see, such as a missing field; [] when none. */
  validate?(value: T): string[];
  /** Every text in the value that a player will read, checked with checkText. */
  texts?(value: T): string[];
  limits?: TextLimits;
  /** The pre-written stand-in. It must not throw: the gateway lets that through. */
  fallback(): T | Promise<T>;
}

/** The value to use, and whether the model or the fallback made it. */
export interface AiResult<T> {
  value: T;
  source: 'ai' | 'fallback';
  // Set when source is fallback.
  reason?: AiFallbackReason;
}
