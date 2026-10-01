import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { type DataSource, QueryFailedError, type Repository } from 'typeorm';
import { FakeClock } from '../../test/support/fake-clock';
import { SeededRandom } from '../../test/support/seeded-random';
import { RandomService } from '../common/random.service';
import { GameConfigService } from '../game-config/game-config.service';
import { generatePlanetCode, isPlanetCode } from './planet-code';
import { PlanetStateService } from './planet-state/planet-state.service';
import type { Planet } from './planet.entity';
import { PlanetsService } from './planets.service';

const CREATED_AT = new Date('2029-12-31T12:00:00.000Z');

/**
 * The slice of Repository<Planet> the service uses, over an in-memory
 * table. Like the database it fills in the id and column defaults, hands out
 * copies, and refuses a second row with the same code.
 */
class FakePlanetRepository {
  readonly rows = new Map<string, Planet>();
  saves = 0;
  // When set, every save fails with it, as if the database were down.
  failure: Error | null = null;
  private nextId = 1;

  save(entity: Partial<Planet>): Promise<Planet> {
    this.saves++;
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    const clash = [...this.rows.values()].some(
      (row) => row.code === entity.code && row.id !== entity.id,
    );
    if (clash) {
      const duplicate = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      return Promise.reject(new QueryFailedError('INSERT', [], duplicate));
    }
    const row = {
      version: 1,
      radiusLevel: 1,
      tutorialStep: 0,
      clouds: [],
      sunOverrideAngle: null,
      sunOverrideAt: null,
      createdAt: CREATED_AT,
      ...entity,
      id: entity.id ?? `planet-${this.nextId++}`,
    } as Planet;
    this.rows.set(row.id, { ...row });
    return Promise.resolve(row);
  }

  findOneBy(where: Partial<Pick<Planet, 'id' | 'code'>>) {
    const row = [...this.rows.values()].find((candidate) =>
      Object.entries(where).every(
        ([key, value]) => candidate[key as keyof Planet] === value,
      ),
    );
    return Promise.resolve(row ? { ...row } : null);
  }

  delete({ id }: { id: string }): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }
}

/**
 * The slice of DataSource that PlanetStateService reads a snapshot through:
 * the planet comes from the fake table, and it has no garden yet.
 */
function snapshotSource(repo: FakePlanetRepository): DataSource {
  const manager = {
    findOneBy: (_entity: unknown, where: { id: string }) =>
      repo.findOneBy(where),
    find: () => Promise.resolve([]),
  };
  return { manager } as unknown as DataSource;
}

/** Always draws the lowest value, so every code is AAAAAAAA. */
class LowestRandom extends RandomService {
  override int(min: number): number {
    return min;
  }
}

interface Setup {
  service: PlanetsService;
  repo: FakePlanetRepository;
  clock: FakeClock;
}

function buildService(
  random: RandomService = new SeededRandom(1),
  env: Record<string, string> = {},
): Setup {
  const repo = new FakePlanetRepository();
  const clock = new FakeClock();
  const config = new GameConfigService({
    get: (key: string) => env[key],
  } as never);
  const service = new PlanetsService(
    repo as unknown as Repository<Planet>,
    clock,
    random,
    config,
    new PlanetStateService(snapshotSource(repo), clock),
  );
  return { service, repo, clock };
}

async function rejection(run: Promise<unknown>): Promise<HttpException> {
  try {
    await run;
  } catch (thrown) {
    return thrown as HttpException;
  }
  throw new Error('expected a rejection');
}

/** Names the default rules (2 to 24 characters) refuse, with the reason shown. */
const refusedNames = [
  ['too short', 'A', 'Planet names need at least 2 characters.'],
  ['too long', 'a'.repeat(25), 'Planet names can be at most 24 characters.'],
  ['offensive', 'Shit Planet', "That name isn't very cosy. How about another?"],
  ['blank', '     ', 'Planet names need at least 2 characters.'],
] as const;

describe('PlanetsService', () => {
  describe('create', () => {
    it('stores the trimmed name and a valid code', async () => {
      const { service, repo } = buildService();

      const planet = await service.create('  Moonbeam  ');

      expect(planet.name).toBe('Moonbeam');
      expect(isPlanetCode(planet.code)).toBe(true);
      expect(repo.rows.get(planet.id)?.name).toBe('Moonbeam');
    });

    it('returns the snapshot of the new planet, at version 1', async () => {
      const { service, clock } = buildService();

      const planet = await service.create('Moonbeam');

      expect(planet).toEqual({
        id: expect.any(String) as string,
        code: expect.any(String) as string,
        name: 'Moonbeam',
        version: 1,
        createdAt: CREATED_AT.toISOString(),
        radiusLevel: 1,
        maxPlants: 60,
        tutorialStep: 0,
        serverTime: clock.now().toISOString(),
        plants: [],
        decorations: [],
        inventory: [],
        unlocks: [],
        clouds: [],
        sun: { overrideAngle: null, overrideAt: null },
      });
    });

    it('starts the simulation now and takes maxPlants from the config', async () => {
      const { service, repo, clock } = buildService(new SeededRandom(1), {
        GAME_MAX_PLANTS: '80',
      });

      const { id } = await service.create('Moonbeam');
      const row = repo.rows.get(id);

      expect(row?.lastSimulatedAt).toEqual(clock.now());
      expect(row?.lastSeenAt).toEqual(clock.now());
      expect(row?.maxPlants).toBe(80);
    });

    it.each(refusedNames)(
      'refuses a %s name with a friendly 400',
      async (_reason, name, message) => {
        const { service, repo } = buildService();

        const error = await rejection(service.create(name));

        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toMatchObject({ message });
        expect(repo.saves).toBe(0);
      },
    );

    it('draws another code when the first is taken', async () => {
      const taken = generatePlanetCode(new SeededRandom(7));
      const { service, repo } = buildService(new SeededRandom(7));
      await repo.save({ code: taken, name: 'First' });

      const planet = await service.create('Second');

      expect(planet.code).not.toBe(taken);
      expect(isPlanetCode(planet.code)).toBe(true);
      expect(repo.saves).toBe(3);
      expect(repo.rows.size).toBe(2);
    });

    it('gives up after a few taken codes', async () => {
      const { service, repo } = buildService(new LowestRandom());
      await repo.save({ code: 'AAAAAAAA', name: 'First' });
      repo.saves = 0;

      await expect(service.create('Second')).rejects.toBeInstanceOf(
        QueryFailedError,
      );
      expect(repo.saves).toBeGreaterThan(1);
      expect(repo.rows.size).toBe(1);
    });

    it('does not retry a failure other than a taken code', async () => {
      const { service, repo } = buildService();
      repo.failure = new Error('connection lost');

      await expect(service.create('Moonbeam')).rejects.toThrow(
        'connection lost',
      );
      expect(repo.saves).toBe(1);
    });
  });

  describe('get', () => {
    it('returns the stored planet', async () => {
      const { service } = buildService();
      const created = await service.create('Moonbeam');

      await expect(service.get(created.id)).resolves.toEqual(created);
    });

    it('answers an unknown planet with 404', async () => {
      const { service } = buildService();

      const error = await rejection(service.get('nowhere'));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toMatchObject({
        message: 'This planet has drifted away',
      });
    });
  });

  describe('rename', () => {
    it('stores and returns the trimmed new name', async () => {
      const { service, repo } = buildService();
      const { id } = await service.create('Moonbeam');

      const renamed = await service.rename(id, '  Sunpatch ');

      expect(renamed.name).toBe('Sunpatch');
      expect(repo.rows.get(id)?.name).toBe('Sunpatch');
    });

    it('keeps the code and does not bump the version', async () => {
      const { service } = buildService();
      const created = await service.create('Moonbeam');

      const renamed = await service.rename(created.id, 'Sunpatch');

      expect(renamed.code).toBe(created.code);
      expect(renamed.version).toBe(created.version);
    });

    it.each(refusedNames)(
      'refuses a %s name with a friendly 400 and keeps the old one',
      async (_reason, name, message) => {
        const { service, repo } = buildService();
        const { id } = await service.create('Moonbeam');

        const error = await rejection(service.rename(id, name));

        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toMatchObject({ message });
        expect(repo.rows.get(id)?.name).toBe('Moonbeam');
      },
    );
  });

  describe('findIdByCode', () => {
    it('finds the planet by its code', async () => {
      const { service } = buildService();
      const { id, code } = await service.create('Moonbeam');

      await expect(service.findIdByCode(code)).resolves.toEqual({ id });
    });

    it('ignores case and surrounding spaces', async () => {
      const { service } = buildService();
      const { id, code } = await service.create('Moonbeam');

      await expect(
        service.findIdByCode(`  ${code.toLowerCase()} `),
      ).resolves.toEqual({ id });
    });

    it.each(['ZZZZZZZZ', 'nope', '', 'ABCD234O'])(
      'answers %p with 404',
      async (code) => {
        const { service } = buildService();
        await service.create('Moonbeam');

        const error = await rejection(service.findIdByCode(code));

        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.getResponse()).toMatchObject({
          message: 'No planet has that code',
        });
      },
    );
  });

  describe('delete', () => {
    it('removes the planet so it can no longer be opened', async () => {
      const { service, repo } = buildService();
      const { id, code } = await service.create('Moonbeam');

      await service.delete(id);

      expect(repo.rows.size).toBe(0);
      await expect(service.get(id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.findIdByCode(code)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
