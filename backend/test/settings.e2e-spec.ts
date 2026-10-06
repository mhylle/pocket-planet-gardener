import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import { DEFAULT_PLAYER_SETTINGS } from '../src/planets/settings-rules';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// Uses the dev database and empties the planets table and its children.
describe('Player settings (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let planetId: string;
  let version: number;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    const created = await request(app.getHttpServer())
      .post('/api/planet')
      .send({ name: 'Moonbeam' })
      .expect(201);
    const snapshot = created.body as PlanetSnapshotDto;
    planetId = snapshot.id;
    version = snapshot.version;
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  function getSettings() {
    return request(app.getHttpServer())
      .get('/api/planet/settings')
      .set('X-Planet-Id', planetId);
  }

  function patchSettings(body: object) {
    return request(app.getHttpServer())
      .patch('/api/planet/settings')
      .set('X-Planet-Id', planetId)
      .send(body);
  }

  async function planetVersion(): Promise<number> {
    const res = await request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', planetId)
      .expect(200);
    return (res.body as PlanetSnapshotDto).version;
  }

  it('gives a new planet the defaults', async () => {
    const res = await getSettings().expect(200);

    expect(res.body).toEqual({
      musicVolume: 0.6,
      musicMuted: false,
      sfxVolume: 0.8,
      sfxMuted: false,
      reducedMotion: 'auto',
    });
  });

  it('keeps the changed settings, answers with all of them, and a fresh load on another device gets them back (SET-01 AC2)', async () => {
    const expected = {
      ...DEFAULT_PLAYER_SETTINGS,
      musicVolume: 0.3,
      sfxMuted: true,
    };

    const res = await patchSettings({ musicVolume: 0.3, sfxMuted: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expected);
    // Another device has only the planet id: a new request with it.
    expect((await getSettings().expect(200)).body).toEqual(expected);
  });

  it('changes only the settings sent, each in its own request', async () => {
    await patchSettings({ musicVolume: 0.3 }).expect(200);
    await patchSettings({ reducedMotion: 'on' }).expect(200);
    const res = await patchSettings({ musicMuted: true, sfxVolume: 0 });

    expect(res.body).toEqual({
      musicVolume: 0.3,
      musicMuted: true,
      sfxVolume: 0,
      sfxMuted: false,
      reducedMotion: 'on',
    });
    expect((await getSettings().expect(200)).body).toEqual(res.body);
  });

  it('accepts both ends of the volume range', async () => {
    const res = await patchSettings({ musicVolume: 0, sfxVolume: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ musicVolume: 0, sfxVolume: 1 });
  });

  it.each([
    [{ musicVolume: 1.5 }],
    [{ sfxVolume: -0.1 }],
    [{ musicVolume: '0.3' }],
    [{ musicMuted: 'yes' }],
    [{ sfxMuted: 1 }],
    [{ reducedMotion: 'sometimes' }],
    [{ textSize: 'large' }],
    [{ musicVolume: 0.3, colour: 'blue' }],
  ])('refuses %j with a 400 and keeps nothing', async (body) => {
    await patchSettings(body).expect(400);

    expect((await getSettings().expect(200)).body).toEqual(
      DEFAULT_PLAYER_SETTINGS,
    );
  });

  it('is no command: the planet version stays as it is', async () => {
    await patchSettings({ musicVolume: 0.3, reducedMotion: 'off' }).expect(200);

    expect(await planetVersion()).toBe(version);
  });

  it('needs the X-Planet-Id header', async () => {
    await request(app.getHttpServer()).get('/api/planet/settings').expect(400);
    await request(app.getHttpServer())
      .patch('/api/planet/settings')
      .send({ musicVolume: 0.3 })
      .expect(400);
  });
});
