import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { Planet } from '../planet.entity';
import { NO_PLANET } from './no-planet.decorator';

/** A request that PlanetGuard has let through to a planet-scoped route. */
export interface PlanetRequest extends Request {
  planetId?: string;
}

// The textual form Postgres accepts for a uuid column, so a malformed id is
// a 400 here rather than a cast error in the query.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global guard: every route is planet-scoped unless marked with NoPlanet().
 * It only checks that the planet exists; loading it is the service's job.
 */
@Injectable()
export class PlanetGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Planet) private readonly planets: Repository<Planet>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const noPlanet = this.reflector.getAllAndOverride<boolean>(NO_PLANET, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (noPlanet) {
      return true;
    }

    const req = context.switchToHttp().getRequest<PlanetRequest>();
    const raw = req.headers['x-planet-id'];
    if (!raw) {
      throw new BadRequestException('Missing X-Planet-Id header');
    }
    if (typeof raw !== 'string' || !UUID.test(raw)) {
      throw new BadRequestException('X-Planet-Id must be a planet id');
    }

    // Postgres prints uuids in lower case; keep the same form so the id
    // compares equal to the one on a loaded row.
    const id = raw.toLowerCase();
    if (!(await this.planets.existsBy({ id }))) {
      throw new NotFoundException('This planet has drifted away');
    }
    req.planetId = id;
    return true;
  }
}
