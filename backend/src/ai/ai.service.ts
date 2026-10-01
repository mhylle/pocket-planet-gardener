import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatMessage } from './ai.types';

/** The parts of the provider's response this adapter reads. */
interface ProviderChatResponse {
  choices?: { message?: { content?: unknown } }[];
}

/**
 * Adapter for an OpenAI-compatible chat endpoint (LiteLLM, Scaleway, Azure
 * OpenAI, Ollama, ...). Optional: if the environment is not configured the
 * application still boots and only a chat request reports 503.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    // Tolerate a trailing slash and an optional /v1 already being present.
    this.baseUrl = (this.config.get<string>('AI_BASE_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    this.apiKey = this.config.get<string>('AI_API_KEY') ?? '';
    this.model = this.config.get<string>('AI_MODEL') ?? '';
    this.timeoutMs = Number(this.config.get<string>('AI_TIMEOUT_MS') ?? 60000);
  }

  /** Sends the whole conversation and returns the model's reply. */
  async complete(messages: ChatMessage[]): Promise<string> {
    if (!(this.baseUrl && this.apiKey && this.model)) {
      throw new ServiceUnavailableException(
        'AI is not configured. Set AI_BASE_URL, AI_API_KEY and AI_MODEL.',
      );
    }

    const body = await this.post<ProviderChatResponse>('/chat/completions', {
      model: this.model,
      messages,
    });

    const reply = body?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      throw new ServiceUnavailableException(
        'AI provider returned an unexpected response shape.',
      );
    }
    return reply;
  }

  /** Performs the call and surfaces transport/HTTP failures as 503. */
  private async post<T>(path: string, payload: unknown): Promise<T> {
    const apiUrl = this.baseUrl.endsWith('/v1')
      ? this.baseUrl
      : `${this.baseUrl}/v1`;

    let response: Response;
    try {
      response = await fetch(`${apiUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // Never log the URL with credentials attached, and never the key.
      this.logger.error(`AI request to ${path} failed: ${reason}`);
      throw new ServiceUnavailableException(
        `Could not reach the AI provider: ${reason}`,
      );
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      this.logger.error(
        `AI provider returned ${response.status} for ${path}: ${detail}`,
      );
      throw new ServiceUnavailableException(
        `AI provider returned ${response.status}.`,
      );
    }

    return (await response.json()) as T;
  }
}
