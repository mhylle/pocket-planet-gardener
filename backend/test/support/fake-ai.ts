import type { ChatMessage } from '../../src/ai/ai.types';

/**
 * A stand-in for the model in e2e tests. It records every conversation it is
 * sent and answers by echoing the last message, or fails with `failure`.
 */
export class FakeAiService {
  readonly calls: ChatMessage[][] = [];
  failure: Error | null = null;

  complete(messages: ChatMessage[]): Promise<string> {
    this.calls.push(messages);
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    return Promise.resolve(`Echo: ${messages[messages.length - 1].content}`);
  }
}
