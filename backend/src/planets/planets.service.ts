import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { RandomService } from '../common/random.service';
import { GameConfigService } from '../game-config/game-config.service';
import { PlanetDto, toPlanetDto } from './dto/planet.dto';
import { nameErrorMessage, validateName } from './name-rules';
import {
  generatePlanetCode,
  isPlanetCode,
  normalisePlanetCode,
} from './planet-code';
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
  ) {}

  /** A new planet with a fresh code, named under the name rules (ACC-02 AC1, AC2). */
  async create(name: string): Promise<PlanetDto> {
    const planetName = this.checkName(name);
    const now = this.clock.now();
    for (let attempt = 1; ; attempt++) {
      try {
        const planet = await this.planets.save({
          code: generatePlanetCode(this.random),
          name: planetName,
          maxPlants: this.config.maxPlants,
          lastSimulatedAt: now,
          lastSeenAt: now,
        });
        return toPlanetDto(planet);
      } catch (error) {
        // The id comes from the database, so the code is the only unique
        // column a new row can collide on: draw another.
        if (attempt >= CODE_ATTEMPTS || !isUniqueViolation(error)) {
          throw error;
        }
      }
    }
  }

  async get(id: string): Promise<PlanetDto> {
    return toPlanetDto(await this.load(id));
  }

  /** Renames under the same rules as create (ACC-02 AC4). Leaves the version alone. */
  async rename(id: string, name: string): Promise<PlanetDto> {
    const planetName = this.checkName(name);
    const planet = await this.load(id);
    planet.name = planetName;
    return toPlanetDto(await this.planets.save(planet));
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
