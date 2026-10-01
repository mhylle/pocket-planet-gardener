import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { CurrentPlanet } from '../src/planets/planet-context/current-planet.decorator';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

/** A planet-scoped route that answers the planet id the guard checked. */
@Controller('test/planet')
class PlanetProbeController {
  @Get()
  echo(@CurrentPlanet() planetId: string): { planetId: string } {
    return { planetId };
  }
}

// Uses the dev database and empties the planets table.
describe('Planet context (e2e)', () => {
  let app: INestApplication<App>;
  let planet: Planet;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService(), [PlanetProbeController]);
  });

  beforeEach(async () => {
    const dataSource = app.get(DataSource);
    await dataSource.query('TRUNCATE "planets" CASCADE');
    const now = new Date('2030-01-01T00:00:00.000Z');
    planet = await dataSource.getRepository(Planet).save({
      code: 'PROBE001',
      name: 'Probe',
      lastSimulatedAt: now,
      lastSeenAt: now,
    });
  });

  afterAll(async () => {
    await app.get(DataSource).query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  it('rejects a planet route without the header with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/planet')
      .expect(400);

    expect(res.body).toMatchObject({ message: 'Missing X-Planet-Id header' });
  });

  it('rejects an id that is not a uuid with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/planet')
      .set('X-Planet-Id', 'nope')
      .expect(400);

    expect(res.body).toMatchObject({
      message: 'X-Planet-Id must be a planet id',
    });
  });

  it('answers an unknown planet with 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/planet')
      .set('X-Planet-Id', '00000000-0000-0000-0000-000000000000')
      .expect(404);

    expect(res.body).toMatchObject({ message: 'This planet has drifted away' });
  });

  it('hands the planet id to the route', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/planet')
      .set('X-Planet-Id', planet.id)
      .expect(200);

    expect(res.body).toEqual({ planetId: planet.id });
  });

  it.each(['/api/config', '/api/catalogue'])(
    'serves %s without the header',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(200);
    },
  );
});
