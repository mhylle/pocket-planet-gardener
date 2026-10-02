import { Controller, HttpCode, INestApplication, Post } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AdminSetting } from '../src/admin/admin-setting.entity';
import { AdminSettingsService } from '../src/admin/admin-settings.service';
import { AiUsage } from '../src/admin/ai-usage.entity';
import { AiGatewayService } from '../src/ai/ai-gateway.service';
import type { AiResult } from '../src/ai/ai-gateway.types';
import { NoPlanet } from '../src/planets/planet-context/no-planet.decorator';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const NAP = 'Zzz... napping, try again later.';
const T0 = '2030-01-02T12:00:00.000Z';
const DEFAULTS = { aiEnabled: true, aiDailyBudget: 1000, aiRequestsToday: 0 };

/** One gateway call, as an AI feature will make it. */
@NoPlanet()
@Controller('test/ai')
class AiProbeController {
  constructor(private readonly moduleRef: ModuleRef) {}

  // Mounted beside AppModule, which does not re-export AiModule.
  private get gateway(): AiGatewayService {
    return this.moduleRef.get(AiGatewayService, { strict: false });
  }

  @Post('line')
  @HttpCode(200)
  line(): Promise<AiResult<string>> {
    return this.gateway.generate({
      feature: 'probe',
      messages: [{ role: 'user', content: 'Say hello.' }],
      parse: (text) => text.trim() || null,
      texts: (line) => [line],
      fallback: () => NAP,
    });
  }
}

// Uses the dev database: empties ai_usage and admin_settings, and leaves
// them empty so the running app is back on the defaults.
describe('Admin settings (e2e)', () => {
  const ai = new FakeAiService();
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    app = await bootWithFakeAi(ai, [AiProbeController]);
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    ai.reset();
    await db.query('TRUNCATE "ai_usage", "admin_settings"');
    // Drops the cached settings, so the defaults apply.
    await app.get(AdminSettingsService, { strict: false }).update({});
  });

  afterAll(async () => {
    await db.query('TRUNCATE "ai_usage", "admin_settings"');
    await app.close();
  });

  function getSettings(at?: string) {
    const req = request(app.getHttpServer()).get('/api/admin/settings');
    return (at ? req.set('X-Test-Now', at) : req).expect(200);
  }

  function patch(body: object) {
    return request(app.getHttpServer()).patch('/api/admin/settings').send(body);
  }

  function probe(at?: string) {
    const req = request(app.getHttpServer()).post('/api/test/ai/line');
    return (at ? req.set('X-Test-Now', at) : req).expect(200);
  }

  it('serves the defaults without a planet header', async () => {
    const res = await getSettings();

    expect(res.body).toEqual(DEFAULTS);
  });

  it('switches the AI off at once and back on (ADM-01 AC1, AC2)', async () => {
    const off = await patch({ aiEnabled: false }).expect(200);
    expect(off.body).toEqual({ ...DEFAULTS, aiEnabled: false });

    const fallback = await probe();
    expect(fallback.body).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'disabled',
    });
    expect(ai.calls).toHaveLength(0);

    await patch({ aiEnabled: true }).expect(200);
    const answered = await probe();
    expect(answered.body).toEqual({ value: 'Echo: Say hello.', source: 'ai' });
    expect(ai.calls).toHaveLength(1);
  });

  it('applies a switch made in the database within a minute (ADM-01 AC1)', async () => {
    const at = (seconds: number) =>
      new Date(Date.parse(T0) + seconds * 1000).toISOString();
    expect((await probe(at(0))).body).toMatchObject({ source: 'ai' });

    await db.getRepository(AdminSetting).save({
      key: 'aiEnabled',
      value: false,
      updatedAt: new Date(T0),
    });

    expect((await probe(at(30))).body).toMatchObject({ source: 'ai' });
    expect((await probe(at(61))).body).toMatchObject({
      source: 'fallback',
      reason: 'disabled',
    });
  });

  it('sends every call to the fallback with a budget of 0 (ADM-02 AC1, AC2)', async () => {
    const res = await patch({ aiDailyBudget: 0 }).expect(200);
    expect(res.body).toEqual({ ...DEFAULTS, aiDailyBudget: 0 });

    expect((await probe()).body).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'budget',
    });
    expect(ai.calls).toHaveLength(0);
  });

  it('changes only the given setting', async () => {
    await patch({ aiDailyBudget: 25 }).expect(200);

    const res = await patch({ aiEnabled: false }).expect(200);

    expect(res.body).toEqual({
      aiEnabled: false,
      aiDailyBudget: 25,
      aiRequestsToday: 0,
    });
  });

  it.each([
    [{ aiDailyBudget: -1 }],
    [{ aiDailyBudget: 1.5 }],
    [{ aiDailyBudget: '10' }],
    [{ aiEnabled: 'no' }],
    [{ somethingElse: true }],
  ])('refuses %j with a 400 and changes nothing', async (body) => {
    await patch(body).expect(400);

    expect((await getSettings()).body).toEqual(DEFAULTS);
  });

  it('counts only the calls the model answered as requests today', async () => {
    await probe();
    await probe();
    await patch({ aiEnabled: false }).expect(200);
    await probe();

    const res = await getSettings();

    expect(res.body).toEqual({
      aiEnabled: false,
      aiDailyBudget: 1000,
      aiRequestsToday: 2,
    });
  });

  it('counts the requests of the current UTC day only', async () => {
    const row = (createdAt: string, usedFallback = false) => ({
      feature: 'probe',
      planetId: null,
      usedFallback,
      reason: usedFallback ? 'error' : null,
      latencyMs: 5,
      createdAt: new Date(createdAt),
    });
    await db
      .getRepository(AiUsage)
      .insert([
        row('2030-01-01T23:59:59.999Z'),
        row('2030-01-02T00:00:00.000Z'),
        row('2030-01-02T23:59:59.999Z'),
        row('2030-01-02T08:00:00.000Z', true),
        row('2030-01-03T00:00:00.000Z'),
      ]);

    const res = await getSettings(T0);

    expect(res.body).toMatchObject({ aiRequestsToday: 2 });
  });
});
