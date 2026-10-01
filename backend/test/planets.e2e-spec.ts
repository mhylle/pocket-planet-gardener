import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { PlanetDto } from '../src/planets/dto/planet.dto';
import { isPlanetCode } from '../src/planets/planet-code';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOT_COSY = "That name isn't very cosy. How about another?";
// Create, get and rename all answer with the snapshot, a superset of PlanetDto.
const SNAPSHOT_KEYS = [
  'clouds',
  'code',
  'createdAt',
  'decorations',
  'id',
  'inventory',
  'maxPlants',
  'name',
  'plants',
  'radiusLevel',
  'serverTime',
  'sun',
  'tutorialStep',
  'unlocks',
  'version',
];

// Uses the dev database and empties the planets table.
describe('Planets (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
  });

  beforeEach(async () => {
    await app.get(DataSource).query('TRUNCATE "planets" CASCADE');
  });

  afterAll(async () => {
    await app.get(DataSource).query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  async function createPlanet(name = 'Moonbeam'): Promise<PlanetDto> {
    const res = await request(app.getHttpServer())
      .post('/api/planet')
      .send({ name })
      .expect(201);
    return res.body as PlanetDto;
  }

  function getPlanet(id: string) {
    return request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', id);
  }

  function rename(id: string, name: string) {
    return request(app.getHttpServer())
      .patch('/api/planet/name')
      .set('X-Planet-Id', id)
      .send({ name });
  }

  describe('POST /api/planet', () => {
    it('creates a planet with a code, the trimmed name and version 1', async () => {
      const planet = await createPlanet('  Moonbeam  ');

      expect(planet.id).toMatch(UUID);
      expect(planet.code).toHaveLength(8);
      expect(isPlanetCode(planet.code)).toBe(true);
      expect(planet.name).toBe('Moonbeam');
      expect(planet.version).toBe(1);
      expect(new Date(planet.createdAt).toISOString()).toBe(planet.createdAt);
      expect(Object.keys(planet).sort()).toEqual(SNAPSHOT_KEYS);
    });

    it('starts the simulation at the request time', async () => {
      const at = '2030-01-01T00:00:00.000Z';
      const res = await request(app.getHttpServer())
        .post('/api/planet')
        .set('X-Test-Now', at)
        .send({ name: 'Moonbeam' })
        .expect(201);

      const row = await app
        .get(DataSource)
        .getRepository(Planet)
        .findOneByOrFail({ id: (res.body as PlanetDto).id });
      expect(row.lastSimulatedAt.toISOString()).toBe(at);
      expect(row.lastSeenAt.toISOString()).toBe(at);
      expect(row.maxPlants).toBe(60);
    });

    it('gives every planet its own code', async () => {
      const first = await createPlanet('First');
      const second = await createPlanet('Second');

      expect(second.code).not.toBe(first.code);
    });

    it('refuses an offensive name with a friendly message (ACC-02 AC2)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planet')
        .send({ name: 'Shit Planet' })
        .expect(400);

      expect(res.body).toMatchObject({ message: NOT_COSY });
    });

    it('refuses a 1-character name, mentioning the minimum of 2', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planet')
        .send({ name: 'A' })
        .expect(400);
      const { message } = res.body as { message: unknown };

      expect(typeof message).toBe('string');
      expect(message).toContain('2');
    });

    it('refuses a 25-character name, mentioning the maximum of 24', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planet')
        .send({ name: 'a'.repeat(25) })
        .expect(400);
      const { message } = res.body as { message: unknown };

      expect(typeof message).toBe('string');
      expect(message).toContain('24');
    });

    it.each([
      ['an extra property', { name: 'Moonbeam', admin: true }],
      ['no name', {}],
      ['a name that is not a string', { name: 42 }],
    ])('refuses a body with %s', async (_case, body) => {
      await request(app.getHttpServer())
        .post('/api/planet')
        .send(body)
        .expect(400);
    });

    it('stores nothing for a refused name', async () => {
      await request(app.getHttpServer())
        .post('/api/planet')
        .send({ name: 'A' })
        .expect(400);

      const count = await app.get(DataSource).getRepository(Planet).count();
      expect(count).toBe(0);
    });
  });

  describe('GET /api/planet', () => {
    it('returns the planet named by the header', async () => {
      const planet = await createPlanet();

      const res = await getPlanet(planet.id).expect(200);

      // Only the server time has moved on since the create.
      expect(res.body).toEqual({
        ...planet,
        serverTime: expect.any(String) as string,
      });
    });

    it('needs the X-Planet-Id header', async () => {
      await request(app.getHttpServer()).get('/api/planet').expect(400);
    });
  });

  describe('PATCH /api/planet/name', () => {
    it('renames the planet, and GET returns the new name', async () => {
      const planet = await createPlanet();

      const res = await rename(planet.id, '  Sunpatch ').expect(200);
      expect(res.body).toMatchObject({
        id: planet.id,
        code: planet.code,
        name: 'Sunpatch',
      });
      expect(Object.keys(res.body as object).sort()).toEqual(SNAPSHOT_KEYS);

      const fetched = await getPlanet(planet.id).expect(200);
      expect((fetched.body as PlanetDto).name).toBe('Sunpatch');
    });

    it.each([
      ['an offensive', 'Shit Planet', NOT_COSY],
      ['a too short', 'A', 'Planet names need at least 2 characters.'],
      [
        'a too long',
        'a'.repeat(25),
        'Planet names can be at most 24 characters.',
      ],
    ])(
      'refuses %s name under the create rules (ACC-02 AC4)',
      async (_case, name, message) => {
        const planet = await createPlanet();

        const res = await rename(planet.id, name).expect(400);
        expect(res.body).toMatchObject({ message });

        const fetched = await getPlanet(planet.id).expect(200);
        expect((fetched.body as PlanetDto).name).toBe('Moonbeam');
      },
    );

    it('needs the X-Planet-Id header', async () => {
      await request(app.getHttpServer())
        .patch('/api/planet/name')
        .send({ name: 'Sunpatch' })
        .expect(400);
    });
  });

  describe('GET /api/planet/by-code/:code', () => {
    it('finds the planet by its code, ignoring case and spaces', async () => {
      const planet = await createPlanet();
      const typed = encodeURIComponent(` ${planet.code.toLowerCase()} `);

      const res = await request(app.getHttpServer())
        .get(`/api/planet/by-code/${typed}`)
        .expect(200);

      expect(res.body).toEqual({ id: planet.id });
    });

    it.each(['ZZZZZZZZ', 'nope'])('answers code %p with 404', async (code) => {
      await createPlanet();

      const res = await request(app.getHttpServer())
        .get(`/api/planet/by-code/${code}`)
        .expect(404);

      expect(res.body).toMatchObject({ message: 'No planet has that code' });
    });
  });

  describe('DELETE /api/planet', () => {
    it.each([
      ['without a confirmation', {}],
      ['with the wrong confirmation', { confirm: 'delete' }],
    ])('refuses %s and keeps the planet', async (_case, body) => {
      const planet = await createPlanet();

      await request(app.getHttpServer())
        .delete('/api/planet')
        .set('X-Planet-Id', planet.id)
        .send(body)
        .expect(400);

      await getPlanet(planet.id).expect(200);
    });

    it('deletes the planet, which then has drifted away (ACC-05 AC1)', async () => {
      const planet = await createPlanet();

      await request(app.getHttpServer())
        .delete('/api/planet')
        .set('X-Planet-Id', planet.id)
        .send({ confirm: 'DELETE' })
        .expect(204);

      const res = await getPlanet(planet.id).expect(404);
      expect(res.body).toMatchObject({
        message: 'This planet has drifted away',
      });
      await request(app.getHttpServer())
        .get(`/api/planet/by-code/${planet.code}`)
        .expect(404);
    });

    it('needs the X-Planet-Id header', async () => {
      await request(app.getHttpServer())
        .delete('/api/planet')
        .send({ confirm: 'DELETE' })
        .expect(400);
    });
  });
});
