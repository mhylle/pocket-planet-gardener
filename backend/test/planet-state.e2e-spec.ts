import {
  BadRequestException,
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
import { Decoration } from '../src/garden/decoration.entity';
import { Plant } from '../src/garden/plant.entity';
import { InventoryItem } from '../src/inventory/inventory-item.entity';
import { Unlock } from '../src/inventory/unlock.entity';
import type { PlanetSnapshotDto } from '../src/planets/dto/planet-snapshot.dto';
import { CurrentPlanet } from '../src/planets/planet-context/current-planet.decorator';
import type { MutationResult } from '../src/planets/planet-state/mutation.types';
import { PlanetStateService } from '../src/planets/planet-state/planet-state.service';
import { Planet } from '../src/planets/planet.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const T0 = new Date('2030-01-01T00:00:00.000Z');
const T1 = new Date('2030-01-01T00:05:00.000Z');
const NOW = '2030-01-01T00:10:00.000Z';

interface ProbeBody {
  expectedVersion: number;
  // Refuse after the insert, so only a rollback can undo it.
  fail?: boolean;
}

/** Commands of the kind Phase 5 adds, run through the real mutate(). */
@Controller('test/state')
class StateProbeController {
  constructor(private readonly moduleRef: ModuleRef) {}

  // The probe is mounted beside AppModule, which does not re-export
  // PlanetsModule, so the service is looked up app-wide.
  private get planetState(): PlanetStateService {
    return this.moduleRef.get(PlanetStateService, { strict: false });
  }

  /** Plants a clover, and refuses afterwards when asked to. */
  @Post('plant')
  @HttpCode(200)
  plant(
    @CurrentPlanet() planetId: string,
    @Body() body: ProbeBody,
  ): Promise<MutationResult> {
    return this.planetState.mutate(
      planetId,
      body.expectedVersion,
      async (ctx) => {
        await ctx.em.insert(Plant, {
          planetId,
          type: 'clover',
          lat: 10,
          lon: 20,
          plantedAt: ctx.now,
        });
        ctx.facts.push({
          type: 'planted',
          occurredAt: ctx.now,
          payload: { type: 'clover' },
        });
        if (body.fail) {
          throw new BadRequestException('The clover wilted');
        }
      },
    );
  }

  /** mutate() without a command, as the heartbeat sync runs it. */
  @Post('sync')
  @HttpCode(200)
  sync(
    @CurrentPlanet() planetId: string,
    @Body() body: ProbeBody,
  ): Promise<MutationResult> {
    return this.planetState.mutate(planetId, body.expectedVersion);
  }
}

// Uses the dev database and empties the planets table and its children.
describe('Planet state (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let planet: Planet;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService(), [StateProbeController]);
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    planet = await db.getRepository(Planet).save({
      code: 'STATE234',
      name: 'Moonbeam',
      lastSimulatedAt: T0,
      lastSeenAt: T0,
    });
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  function getSnapshot() {
    return request(app.getHttpServer())
      .get('/api/planet')
      .set('X-Planet-Id', planet.id)
      .set('X-Test-Now', NOW);
  }

  function probe(route: 'plant' | 'sync', body: ProbeBody) {
    return request(app.getHttpServer())
      .post(`/api/test/state/${route}`)
      .set('X-Planet-Id', planet.id)
      .set('X-Test-Now', NOW)
      .send(body);
  }

  async function storedState(): Promise<{ version: number; plants: number }> {
    const row = await db
      .getRepository(Planet)
      .findOneByOrFail({ id: planet.id });
    const plants = await db
      .getRepository(Plant)
      .countBy({ planetId: planet.id });
    return { version: row.version, plants };
  }

  describe('GET /api/planet', () => {
    it('serves a fresh planet as a snapshot with every key and empty lists', async () => {
      const res = await getSnapshot().expect(200);

      expect(res.body).toStrictEqual({
        id: planet.id,
        code: 'STATE234',
        name: 'Moonbeam',
        version: 1,
        createdAt: planet.createdAt.toISOString(),
        radiusLevel: 1,
        maxPlants: 60,
        tutorialStep: 0,
        serverTime: NOW,
        plants: [],
        decorations: [],
        inventory: [],
        unlocks: [],
        clouds: [],
        sun: { overrideAngle: null, overrideAt: null },
      });
    });

    it('serves the garden in a stable order, with numbers, and only the stacks still held', async () => {
      await db
        .getRepository(Planet)
        .update(planet.id, { sunOverrideAngle: 1.25, sunOverrideAt: T1 });
      // Inserted out of order, so only the query can sort them.
      const plant = { planetId: planet.id, type: 'clover' as const, lat: 12.5 };
      await db.getRepository(Plant).insert([
        {
          ...plant,
          id: '00000000-0000-4000-8000-00000000000c',
          lon: 3,
          plantedAt: T1,
        },
        {
          ...plant,
          id: '00000000-0000-4000-8000-00000000000b',
          lon: 2,
          plantedAt: T0,
        },
        {
          ...plant,
          id: '00000000-0000-4000-8000-00000000000a',
          lon: 1,
          plantedAt: T0,
        },
      ]);
      await db.getRepository(Decoration).insert([
        { planetId: planet.id, type: 'rock', lat: 0, lon: 1, placedAt: T1 },
        { planetId: planet.id, type: 'pond', lat: -3, lon: 100, placedAt: T0 },
      ]);
      await db.getRepository(InventoryItem).insert([
        { planetId: planet.id, itemType: 'tulip', kind: 'seed', count: 2 },
        { planetId: planet.id, itemType: 'fern', kind: 'seed', count: 0 },
        {
          planetId: planet.id,
          itemType: 'bench',
          kind: 'decoration',
          count: 1,
        },
      ]);
      await db.getRepository(Unlock).insert([
        { planetId: planet.id, itemType: 'tulip', unlockedAt: T0 },
        { planetId: planet.id, itemType: 'clover', unlockedAt: T0 },
      ]);

      const res = await getSnapshot().expect(200);
      const snapshot = res.body as PlanetSnapshotDto;

      // Strict, so a number served as a string fails here.
      const served = (id: string, lon: number, plantedAt: Date) => ({
        id,
        type: 'clover',
        lat: 12.5,
        lon,
        stage: 'seed',
        growth: 0,
        water: 0.5,
        plantedAt: plantedAt.toISOString(),
        harvestReady: false,
      });
      expect(snapshot.plants).toStrictEqual([
        served('00000000-0000-4000-8000-00000000000a', 1, T0),
        served('00000000-0000-4000-8000-00000000000b', 2, T0),
        served('00000000-0000-4000-8000-00000000000c', 3, T1),
      ]);
      expect(snapshot.decorations.map((d) => [d.type, d.lat, d.lon])).toEqual([
        ['pond', -3, 100],
        ['rock', 0, 1],
      ]);
      expect(snapshot.inventory).toStrictEqual([
        { itemType: 'bench', kind: 'decoration', count: 1 },
        { itemType: 'tulip', kind: 'seed', count: 2 },
      ]);
      expect(snapshot.unlocks).toEqual(['clover', 'tulip']);
      expect(snapshot.sun).toStrictEqual({
        overrideAngle: 1.25,
        overrideAt: T1.toISOString(),
      });
    });
  });

  describe('mutate()', () => {
    it('applies a command: version 2, and the snapshot shows its plant', async () => {
      const res = await probe('plant', { expectedVersion: 1 }).expect(200);
      const result = res.body as MutationResult;

      expect(result.snapshot).toMatchObject({ version: 2, serverTime: NOW });
      expect(result.snapshot.plants).toStrictEqual([
        {
          id: expect.any(String) as string,
          type: 'clover',
          lat: 10,
          lon: 20,
          stage: 'seed',
          growth: 0,
          water: 0.5,
          plantedAt: NOW,
          harvestReady: false,
        },
      ]);
      expect(result.events).toEqual([
        { type: 'planted', occurredAt: NOW, payload: { type: 'clover' } },
      ]);
      expect(result.newlyUnlocked).toEqual([]);
      await expect(storedState()).resolves.toEqual({ version: 2, plants: 1 });
    });

    it('rolls back a command that throws: no plant row, version unchanged', async () => {
      const res = await probe('plant', {
        expectedVersion: 1,
        fail: true,
      }).expect(400);

      expect(res.body).toMatchObject({ message: 'The clover wilted' });
      await expect(storedState()).resolves.toEqual({ version: 1, plants: 0 });
    });

    it('refuses a stale version with 409 reload and changes nothing (ACC-04 AC2)', async () => {
      const res = await probe('plant', { expectedVersion: 2 }).expect(409);

      expect(res.body).toMatchObject({ message: 'reload' });
      await expect(storedState()).resolves.toEqual({ version: 1, plants: 0 });
    });

    it('keeps the version when there is no command', async () => {
      const res = await probe('sync', { expectedVersion: 1 }).expect(200);
      const result = res.body as MutationResult;

      expect(result.snapshot).toMatchObject({ version: 1, serverTime: NOW });
      expect(result.events).toEqual([]);
      await expect(storedState()).resolves.toEqual({ version: 1, plants: 0 });
    });

    it('lets only one of two commands sent at once on the same version through', async () => {
      const responses = await Promise.all([
        probe('plant', { expectedVersion: 1 }),
        probe('plant', { expectedVersion: 1 }),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
      await expect(storedState()).resolves.toEqual({ version: 2, plants: 1 });
    });
  });
});
