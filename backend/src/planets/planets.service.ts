import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { RandomService } from '../common/random.service';
import { STARTER_INVENTORY } from '../content/starter';
import { GameConfigService } from '../game-config/game-config.service';
import {
  InventoryService,
  type GrantItem,
} from '../inventory/inventory.service';
import type { PlanetSnapshotDto } from './dto/planet-snapshot.dto';
import { nameErrorMessage, validateName } from './name-rules';
import {
  generatePlanetCode,
  isPlanetCode,
  normalisePlanetCode,
} from './planet-code';
import { PlanetStateService } from './planet-state/planet-state.service';
import { Planet } from './planet.entity';

// With 31^8 possible codes a fresh one almost never collides, so a few
// draws are plenty.
const CODE_ATTEMPTS = 5;

/** Postgres unique_violation. */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === '23505'
  );
}

/** Planet lifecycle: create, read, rename, open by code and delete (ACC-01, ACC-02, ACC-04, ACC-05). */
@Injectable()
export class PlanetsService {
  constructor(
    @InjectRepository(Planet) private readonly planets: Repository<Planet>,
    private readonly clock: ClockService,
    private readonly random: RandomService,
    private readonly config: GameConfigService,
    private readonly planetState: PlanetStateService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * A new planet with a fresh code, named under the name rules (ACC-02 AC1,
   * AC2), holding the first starterSeedTypes starter seeds, unlocked
   * (ITM-04 AC1).
   */
  async create(name: string): Promise<PlanetSnapshotDto> {
    const planetName = this.checkName(name);
    const now = this.clock.now();
    const starter = STARTER_INVENTORY.slice(0, this.config.starterSeedTypes);
    const seeds = starter.map(({ itemType, count }): GrantItem => ({
      itemType,
      kind: 'seed',
      count,
    }));
    for (let attempt = 1; ; attempt++) {
      try {
        // One transaction per attempt: a failed insert aborts its transaction.
        return await this.planets.manager.transaction(async (em) => {
          const planet = await em.save(Planet, {
            code: generatePlanetCode(this.random),
            name: planetName,
            maxPlants: this.config.maxPlants,
            lastSimulatedAt: now,
            lastSeenAt: now,
          });
          await this.inventory.grant(em, planet.id, seeds, now);
          return this.planetState.getSnapshot(planet.id, em);
        });
      } catch (error) {
        // The id comes from the database, so the code is the only unique
        // column a new row can collide on: draw another.
        if (attempt >= CODE_ATTEMPTS || !isUniqueViolation(error)) {
          throw error;
        }
      }
    }
  }

  get(id: string): Promise<PlanetSnapshotDto> {
    return this.planetState.getSnapshot(id);
  }

  /** Renames under the same rules as create (ACC-02 AC4). Leaves the version alone. */
  async rename(id: string, name: string): Promise<PlanetSnapshotDto> {
    const planetName = this.checkName(name);
    const planet = await this.load(id);
    planet.name = planetName;
    await this.planets.save(planet);
    return this.planetState.getSnapshot(id);
  }

  /**
   * The planet a code opens on another device (ACC-04). Case and surrounding
   * spaces do not matter; a malformed code is just as unknown as a free one.
   */
  async findIdByCode(raw: string): Promise<{ id: string }> {
    const code = normalisePlanetCode(raw);
    const planet = isPlanetCode(code)
      ? await this.planets.findOneBy({ code })
      : null;
    if (!planet) {
      throw new NotFoundException('No planet has that code');
    }
    return { id: planet.id };
  }

  /**
   * Removes the planet for good (ACC-05 AC1). Every table that refers to a
   * planet does so ON DELETE CASCADE, so its rows go with it.
   */
  async delete(id: string): Promise<void> {
    await this.planets.delete({ id });
  }

  private async load(id: string): Promise<Planet> {
    const planet = await this.planets.findOneBy({ id });
    if (!planet) {
      throw new NotFoundException('This planet has drifted away');
    }
    return planet;
  }

  /** The trimmed name, or a 400 with the friendly reason it was refused. */
  private checkName(name: string): string {
    const limits = {
      min: this.config.planetNameMin,
      max: this.config.planetNameMax,
    };
    const check = validateName(name, limits);
    if (check !== 'ok') {
      throw new BadRequestException(nameErrorMessage(check, limits, 'Planet'));
    }
    return name.trim();
  }
}
