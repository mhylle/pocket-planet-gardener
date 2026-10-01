import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { CatalogueDto } from '../src/catalogue/dto/catalogue.dto';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

describe('GET /api/catalogue (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves plants, decorations and species without a planet', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/catalogue')
      .expect(200);
    const body = res.body as CatalogueDto;

    expect(Object.keys(body).sort()).toEqual([
      'decorations',
      'plants',
      'species',
    ]);
    expect(body.plants.length).toBeGreaterThanOrEqual(8);
    expect(body.decorations.length).toBeGreaterThanOrEqual(5);
    expect(body.species.length).toBeGreaterThanOrEqual(6);

    for (const plant of body.plants) {
      expect(typeof plant.bloomMinutes).toBe('number');
      expect(typeof plant.waterPref).toBe('string');
      expect(typeof plant.lightPref).toBe('string');
    }
    for (const species of body.species) {
      expect(typeof species.hint).toBe('string');
      expect(species).not.toHaveProperty('arrivalCondition');
    }
  });
});
