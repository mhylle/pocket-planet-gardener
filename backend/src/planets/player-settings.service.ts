import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planet } from './planet.entity';
import {
  applyChanges,
  withDefaults,
  type PlayerSettings,
} from './settings-rules';

/**
 * The player's audio and motion settings (SET-01, SET-03). They live on the
 * planet, which under D-0 is the player, so they come back on any device
 * (SET-01 AC2). Settings are not gameplay: no command, and the version stays
 * as it is.
 */
@Injectable()
export class PlayerSettingsService {
  constructor(
    @InjectRepository(Planet) private readonly planets: Repository<Planet>,
  ) {}

  async get(planetId: string): Promise<PlayerSettings> {
    const planet = await this.planets.findOneBy({ id: planetId });
    if (!planet) {
      throw new NotFoundException('This planet has drifted away');
    }
    return withDefaults(planet.settings);
  }

  /**
   * Keeps the given settings and leaves the others alone. The row is locked,
   * so changes sent from two tabs at once do not drop each other.
   */
  update(
    planetId: string,
    changes: Partial<PlayerSettings>,
  ): Promise<PlayerSettings> {
    return this.planets.manager.transaction(async (em) => {
      const planet = await em.findOne(Planet, {
        where: { id: planetId },
        lock: { mode: 'for_no_key_update' },
      });
      if (!planet) {
        throw new NotFoundException('This planet has drifted away');
      }
      const settings = applyChanges(planet.settings, changes);
      await em.update(Planet, { id: planetId }, { settings });
      return withDefaults(settings);
    });
  }
}
