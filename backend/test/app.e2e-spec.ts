import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// Boots the whole app against the dev database (DB_* in .env).
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
  });

  afterAll(async () => {
    await app.close();
  });

  it('no longer serves the placeholder chat', async () => {
    await request(app.getHttpServer()).get('/api/messages').expect(404);
  });
});
