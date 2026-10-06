import { NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import type { Planet } from './planet.entity';
import { PlayerSettingsService } from './player-settings.service';
import { DEFAULT_PLAYER_SETTINGS, type PlayerSettings } from './settings-rules';

const PLANET_ID = 'planet-1';

/** A Planet repository holding one planet with these stored settings, or none. */
function setup(settings: Partial<PlayerSettings> | null) {
  const updates: unknown[][] = [];
  const locks: unknown[] = [];
  const planet = () =>
    Promise.resolve(settings === null ? null : { id: PLANET_ID, settings });
  const em = {
    findOne: (_entity: unknown, options: { lock?: unknown }) => {
      locks.push(options.lock);
      return planet();
    },
    update: (_entity: unknown, ...args: unknown[]) => {
      updates.push(args);
      return Promise.resolve({ affected: 1 });
    },
  } as unknown as EntityManager;
  const planets = {
    findOneBy: planet,
    manager: {
      transaction: <T>(work: (em: EntityManager) => Promise<T>) => work(em),
    },
  } as unknown as Repository<Planet>;
  return { service: new PlayerSettingsService(planets), updates, locks };
}

describe('PlayerSettingsService', () => {
  it('reads the stored settings with the defaults filled in', async () => {
    const { service } = setup({ sfxMuted: true });

    await expect(service.get(PLANET_ID)).resolves.toEqual({
      ...DEFAULT_PLAYER_SETTINGS,
      sfxMuted: true,
    });
  });

  it('keeps only the changed settings on the locked planet row and answers with all of them', async () => {
    const { service, updates, locks } = setup({ sfxMuted: true });

    await expect(
      service.update(PLANET_ID, { musicVolume: 0.3 }),
    ).resolves.toEqual({
      ...DEFAULT_PLAYER_SETTINGS,
      musicVolume: 0.3,
      sfxMuted: true,
    });
    expect(locks).toEqual([{ mode: 'for_no_key_update' }]);
    expect(updates).toEqual([
      [{ id: PLANET_ID }, { settings: { sfxMuted: true, musicVolume: 0.3 } }],
    ]);
  });

  it('is a 404 when the planet has gone', async () => {
    const { service, updates } = setup(null);

    await expect(service.get(PLANET_ID)).rejects.toThrow(NotFoundException);
    await expect(
      service.update(PLANET_ID, { musicMuted: true }),
    ).rejects.toThrow(NotFoundException);
    expect(updates).toEqual([]);
  });
});
