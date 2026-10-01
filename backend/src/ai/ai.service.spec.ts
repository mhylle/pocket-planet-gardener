import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';

// The failure cases log on purpose; keep that out of the test output.
beforeAll(() => {
  Logger.overrideLogger(false);
});

/**
 * AiService only needs ConfigService#get, so it is constructed directly with a
 * stub. That keeps this a pure unit test: no Nest container, no network.
 */
function buildService(env: Record<string, string>): AiService {
  return new AiService({ get: (key: string) => env[key] } as never);
}

const configured = {
  AI_BASE_URL: 'http://example.test:8101/',
  AI_API_KEY: 'test-key',
  AI_MODEL: 'test-model',
};

interface SentRequest {
  url: string;
  init: RequestInit;
}

/** Answers every fetch with the given response and records what was sent. */
function stubFetch(response: Response): SentRequest[] {
  const sent: SentRequest[] = [];
  globalThis.fetch = (url, init) => {
    sent.push({ url: url as string, init: init ?? {} });
    return Promise.resolve(response);
  };
  return sent;
}

const conversation = [
  { role: 'user' as const, content: 'What is 2+2?' },
  { role: 'assistant' as const, content: '4.' },
  { role: 'user' as const, content: 'And times 3?' },
];

describe('AiService', () => {
  it('rejects with 503 without calling out when unconfigured', async () => {
    const sent = stubFetch(Response.json({}));

    await expect(buildService({}).complete(conversation)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(sent).toHaveLength(0);
  });

  it('sends the whole conversation and returns the reply', async () => {
    const sent = stubFetch(
      Response.json({ choices: [{ message: { content: '12.' } }] }),
    );

    await expect(buildService(configured).complete(conversation)).resolves.toBe(
      '12.',
    );

    // Trailing slash normalised away, /v1 added.
    expect(sent[0].url).toBe('http://example.test:8101/v1/chat/completions');
    expect(sent[0].init.headers).toMatchObject({
      Authorization: 'Bearer test-key',
    });
    expect(JSON.parse(sent[0].init.body as string)).toEqual({
      model: 'test-model',
      messages: conversation,
    });
  });

  it('turns a provider error status into 503', async () => {
    stubFetch(new Response('upstream broke', { status: 500 }));

    await expect(
      buildService(configured).complete(conversation),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('turns an unreachable provider into 503', async () => {
    globalThis.fetch = () => Promise.reject(new Error('connect ECONNREFUSED'));

    await expect(
      buildService(configured).complete(conversation),
    ).rejects.toThrow('Could not reach the AI provider: connect ECONNREFUSED');
  });

  it('turns an unexpected response shape into 503', async () => {
    stubFetch(Response.json({ choices: [] }));

    await expect(
      buildService(configured).complete(conversation),
    ).rejects.toThrow('AI provider returned an unexpected response shape.');
  });
});
