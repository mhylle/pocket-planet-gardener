import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

interface MessageBody {
  id: number;
  role: string;
  text: string;
}

// Runs against the dev database (DB_* in .env) and empties its messages table.
describe('Messages (e2e)', () => {
  let app: INestApplication<App>;
  const ai = new FakeAiService();

  beforeAll(async () => {
    app = await bootWithFakeAi(ai);
  });

  beforeEach(async () => {
    await app.get(DataSource).query('TRUNCATE "messages" RESTART IDENTITY');
    ai.calls.length = 0;
    ai.failure = null;
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (body: object) =>
    request(app.getHttpServer()).post('/api/messages').send(body);

  const conversation = async () => {
    const res = await request(app.getHttpServer())
      .get('/api/messages')
      .expect(200);
    return (res.body as MessageBody[]).map((m) => [m.role, m.text]);
  };

  it('stores the message and the reply, and returns both', async () => {
    const res = await send({ text: 'Hello' }).expect(201);

    expect(res.body).toMatchObject([
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Echo: Hello' },
    ]);
    expect(await conversation()).toEqual([
      ['user', 'Hello'],
      ['assistant', 'Echo: Hello'],
    ]);
  });

  it('sends the earlier conversation to the AI as context', async () => {
    await send({ text: 'First' }).expect(201);
    await send({ text: 'Second' }).expect(201);

    expect(ai.calls[1]).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Echo: First' },
      { role: 'user', content: 'Second' },
    ]);
    expect(await conversation()).toEqual([
      ['user', 'First'],
      ['assistant', 'Echo: First'],
      ['user', 'Second'],
      ['assistant', 'Echo: Second'],
    ]);
  });

  it.each([{}, { text: '' }, { text: 42 }, { text: 'x'.repeat(4001) }])(
    'rejects %j with 400 without calling the AI',
    async (body) => {
      await send(body).expect(400);

      expect(ai.calls).toHaveLength(0);
      expect(await conversation()).toEqual([]);
    },
  );

  it('rejects unknown properties', async () => {
    await send({ text: 'Hi', model: 'other' }).expect(400);
  });

  it('answers 503 and stores nothing when the AI fails', async () => {
    ai.failure = new ServiceUnavailableException(
      'Could not reach the AI provider.',
    );

    const res = await send({ text: 'Anyone there?' }).expect(503);

    expect((res.body as { message: string }).message).toBe(
      'Could not reach the AI provider.',
    );
    expect(await conversation()).toEqual([]);
  });
});
