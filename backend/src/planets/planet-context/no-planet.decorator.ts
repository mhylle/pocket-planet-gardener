import { SetMetadata } from '@nestjs/common';

export const NO_PLANET = 'noPlanet';

/**
 * Marks a route, or every route of a controller, that works without a
 * planet, so PlanetGuard lets it through without an X-Planet-Id header.
 */
export const NoPlanet = () => SetMetadata(NO_PLANET, true);
