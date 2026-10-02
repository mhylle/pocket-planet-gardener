import {
  Body,
  Controller,
  HttpCode,
  INestApplication,
  Post,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AdminSettingsService } from '../src/admin/admin-settings.service';
import { AiUsage } from '../src/admin/ai-usage.entity';
import { AiGatewayService } from '../src/ai/ai-gateway.service';
import type { AiRequest, AiResult } from '../src/ai/ai-gateway.types';
import { CurrentPlanet } from '../src/planets/planet-context/current-planet.decorator';
import { NoPlanet } from '../src/planets/planet-context/no-planet.decorator';
import { PlanetStateService } from '../src/planets/planet-state/planet-state.service';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const PROMPT = 'Say hello to the gardener.';
const NAP = 'Zzz... napping, try again later.';

interface ProbeBody {
  planetId?: string;
}

/** A request for a short line, as a creature feature will make it. */
function lineRequest(planetId?: string): AiRequest<string> {
  return {
    feature: 'probe',
    planetId,
    messages: [{ role: 'user', content: PROMPT }],
    parse: (text) => text.trim() || null,
    texts: (line) => [line],
    limits: { maxWords: 60 },
    fallback: () => NAP,
  };
}

/** One gateway call on its own. */
@NoPlanet()
@Controller('test/ai')
class AiProbeController {
  constructor(private readonly moduleRef: ModuleRef) {}

  // The probe is mounted beside AppModule, which does not re-export
  // AiModule, so the gateway is looked up app-wide.
  private get gateway(): AiGatewayService {
    return this.moduleRef.get(AiGatewayService, { strict: false });
  }

  @Post('line')
  @HttpCode(200)
  line(@Body() body: ProbeBody): Promise<AiResult<string>> {
    return this.gateway.generate(lineRequest(body.planetId));
  }
}

/** One gateway call inside a command, as a creature arrival will make it. */
@Controller('test/ai-command')
class AiCommandProbeController {
  constructor(private readonly moduleRef: ModuleRef) {}

  @Post()
  @HttpCode(200)
  async command(
    @CurrentPlanet() planetId: string,
    @Body() body: { expectedVersion: number },
  ): Promise<{ ai: AiResult<string>; version: number }> {
    const gateway = this.moduleRef.get(AiGatewayService, { strict: false });
    const planetState = this.moduleRef.get(PlanetStateService, {
      strict: false,
    });
    let ai: AiResult<string> | undefined;
    const result = await planetState.mutate(
      planetId,
      body.expectedVersion,
      async () => {
        ai = await gateway.generate(lineRequest(planetId));
      },
    );
    return { ai: ai!, version: result.snapshot.version };
  }
}

// Uses the dev database: empties ai_usage, admin_settings and planets.
describe('AI gateway (e2e)', () => {
  const ai = new FakeAiService();
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    app = await bootWithFakeAi(ai, [
      AiProbeController,
      AiCommandProbeController,
    ]);
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    ai.reset();
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    // Drops the cached settings, so the defaults apply.
    await app.get(AdminSettingsService, { strict: false }).update({});
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets", "ai_usage", "admin_settings" CASCADE');
    await app.close();
  });

  function probe(body: ProbeBody = {}) {
    return request(app.getHttpServer())
      .post('/api/test/ai/line')
      .send(body)
      .expect(200);
  }

  function usageRows(): Promise<AiUsage[]> {
    return db.getRepository(AiUsage).find({ order: { createdAt: 'ASC' } });
  }

  it('returns the model reply through the real module and logs one answered call', async () => {
    const res = await probe();

    expect(res.body).toEqual({ value: `Echo: ${PROMPT}`, source: 'ai' });
    expect(ai.calls).toEqual([[{ role: 'user', content: PROMPT }]]);
    const rows = await usageRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      feature: 'probe',
      planetId: null,
      usedFallback: false,
      reason: null,
    });
    expect(rows[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('answers with the fallback, not an error, when the model fails (AIB-05 AC1)', async () => {
    ai.respondWith(new Error('AI provider returned 503.'));

    const res = await probe();

    expect(res.body).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'error',
    });
    expect(ai.calls).toHaveLength(1);
    expect(await usageRows()).toMatchObject([
      { usedFallback: true, reason: 'error' },
    ]);
  });

  it('retries a reply that breaks the content rules, then falls back (AIB-01 AC2)', async () => {
    ai.respondWith('I was so lonely without you.', 'Where were you?');

    const res = await probe();

    expect(res.body).toEqual({
      value: NAP,
      source: 'fallback',
      reason: 'invalid',
    });
    expect(ai.calls).toHaveLength(2);
    expect(await usageRows()).toMatchObject([
      { usedFallback: true, reason: 'invalid' },
    ]);
  });

  async function createPlanet(): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .send({ name: 'Moonbeam' })
      .expect(201);
    return (created.body as { id: string }).id;
  }

  // A short timeout: the planet row's lock once made the usage row's
  // insert wait for the command forever.
  it('completes a call made inside a command on the locked planet', async () => {
    const planetId = await createPlanet();

    const res = await request(app.getHttpServer())
      .post('/api/test/ai-command')
      .set('X-Planet-Id', planetId)
      .send({ expectedVersion: 1 })
      .expect(200);

    expect(res.body).toEqual({
      ai: { value: `Echo: ${PROMPT}`, source: 'ai' },
      version: 2,
    });
    expect(await usageRows()).toMatchObject([
      { feature: 'probe', planetId, usedFallback: false },
    ]);
  }, 5000);

  it("keeps a planet's usage rows, without the planet, when it is deleted", async () => {
    const planetId = await createPlanet();

    await probe({ planetId });
    expect(await usageRows()).toMatchObject([{ planetId }]);

    await request(app.getHttpServer())
      .delete('/api/planet')
      .set('X-Planet-Id', planetId)
      .send({ confirm: 'DELETE' })
      .expect(204);
    expect(await usageRows()).toMatchObject([
      { planetId: null, usedFallback: false },
    ]);
  });
});
