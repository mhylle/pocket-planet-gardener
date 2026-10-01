import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClockService } from '../src/common/clock.service';
import { NoPlanet } from '../src/planets/planet-context/no-planet.decorator';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

/** Answers the time the request sees, read after an await. */
@NoPlanet()
@Controller('test/clock')
class ClockProbeController {
  constructor(private readonly clock: ClockService) {}

  @Get()
  async now(): Promise<{ now: string }> {
    await new Promise((resolve) => setImmediate(resolve));
    return { now: this.clock.now().toISOString() };
  }
}

// Jest sets NODE_ENV=test, so the server honours X-Test-Now.
describe('X-Test-Now (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService(), [ClockProbeController]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the request at the given instant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/clock')
      .set('X-Test-Now', '2030-01-01T00:00:00.000Z')
      .expect(200);

    expect(res.body).toEqual({ now: '2030-01-01T00:00:00.000Z' });
  });

  it('uses the real time without the header', async () => {
    const before = Date.now();
    const res = await request(app.getHttpServer())
      .get('/api/test/clock')
      .expect(200);
    const { now } = res.body as { now: string };

    expect(Date.parse(now)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(now)).toBeLessThanOrEqual(Date.now());
  });

  it('rejects an unparseable X-Test-Now with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/clock')
      .set('X-Test-Now', 'banana')
      .expect(400);

    expect(res.body).toMatchObject({
      message: 'X-Test-Now must be an ISO timestamp',
    });
  });
});
