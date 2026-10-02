import type { ChatMessage } from '../../src/ai/ai.types';

/** A scripted answer: a reply text, the text 'hang' (never answers) or an Error (rejects). */
export type ScriptedReply = string | Error;

/**
 * A stand-in for the model in tests. It records every conversation it is
 * sent and answers with the next scripted reply; with none queued it echoes
 * the last message, or rejects with the failure when one is set.
 */
export class FakeAiService {
  readonly calls: ChatMessage[][] = [];
  failure: Error | null = null;
  private readonly script: ScriptedReply[] = [];

  /** Queues answers for the next calls, used up in order. */
  respondWith(...replies: ScriptedReply[]): void {
    this.script.push(...replies);
  }

  /** Forgets the calls, the queued answers and the failure. */
  reset(): void {
    this.calls.length = 0;
    this.script.length = 0;
    this.failure = null;
  }

  complete(messages: ChatMessage[]): Promise<string> {
    this.calls.push(messages);
    const next = this.script.shift();
    if (next === 'hang') {
      return new Promise<string>(() => {});
    }
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    if (next !== undefined) {
      return Promise.resolve(next);
    }
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    return Promise.resolve(`Echo: ${messages[messages.length - 1].content}`);
  }
}
