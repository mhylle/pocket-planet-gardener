import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// Assumes backend/.env sets no GAME_* variable, so every value is the SD default.
describe('GET /api/config (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the client-relevant tunables without a planet', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/config')
      .expect(200);

    expect(res.body).toEqual({
      planetNameMin: 2,
      planetNameMax: 24,
      maxPlants: 60,
      maxCreatures: 8,
      chatMessageMaxChars: 200,
      chatDailyLimit: 30,
      syncIntervalSeconds: 10,
      cloudRefillSeconds: 60,
      sunOverrideMinutes: 5,
      summaryAfterMinutes: 60,
      journalAfterHours: 4,
    });
  });
});
