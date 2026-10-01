import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PlanetRequest } from './planet.guard';

/**
 * The id of the planet the request is about, as checked by PlanetGuard.
 * Only meaningful on planet-scoped routes, not on NoPlanet() ones.
 */
export const CurrentPlanet = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<PlanetRequest>().planetId,
);
