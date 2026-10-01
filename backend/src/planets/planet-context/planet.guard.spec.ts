import {
  BadRequestException,
  ExecutionContext,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Repository } from 'typeorm';
import type { Planet } from '../planet.entity';
import { NoPlanet } from './no-planet.decorator';
import { PlanetGuard, PlanetRequest } from './planet.guard';

const KNOWN_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

// Handlers take this: void because the guard only reads their metadata.
class ScopedController {
  route(this: void): void {}

  @NoPlanet()
  open(this: void): void {}
}

@NoPlanet()
class OpenController {
  route(this: void): void {}
}

/**
 * The guard only needs Repository#existsBy, so it gets a fake that knows a
 * single planet, beside the real Reflector.
 */
function buildGuard(): PlanetGuard {
  const planets = {
    existsBy: ({ id }: { id: string }) => Promise.resolve(id === KNOWN_ID),
  };
  return new PlanetGuard(
    new Reflector(),
    planets as unknown as Repository<Planet>,
  );
}

function contextFor(
  req: PlanetRequest,
  controller: object,
  handler: () => void,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function requestWith(planetId?: string): PlanetRequest {
  const headers = planetId === undefined ? {} : { 'x-planet-id': planetId };
  return { headers } as PlanetRequest;
}

/** Runs the guard on a planet-scoped route. */
function guardScoped(req: PlanetRequest): Promise<boolean> {
  return buildGuard().canActivate(
    contextFor(req, ScopedController, ScopedController.prototype.route),
  );
}

async function rejection(run: Promise<boolean>): Promise<HttpException> {
  try {
    await run;
  } catch (thrown) {
    return thrown as HttpException;
  }
  throw new Error('expected the guard to reject');
}

describe('PlanetGuard', () => {
  it('lets a NoPlanet() handler through without the header', async () => {
    const req = requestWith();

    await expect(
      buildGuard().canActivate(
        contextFor(req, ScopedController, ScopedController.prototype.open),
      ),
    ).resolves.toBe(true);
    expect(req.planetId).toBeUndefined();
  });

  it('lets every route of a NoPlanet() controller through', async () => {
    await expect(
      buildGuard().canActivate(
        contextFor(
          requestWith(),
          OpenController,
          OpenController.prototype.route,
        ),
      ),
    ).resolves.toBe(true);
  });

  it.each([undefined, ''])(
    'rejects X-Planet-Id: %p as missing with 400',
    async (planetId) => {
      const error = await rejection(guardScoped(requestWith(planetId)));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({
        message: 'Missing X-Planet-Id header',
      });
    },
  );

  it.each(['nope', `${KNOWN_ID}x`, KNOWN_ID.replaceAll('-', '')])(
    'rejects X-Planet-Id: %p as not a planet id with 400',
    async (planetId) => {
      const error = await rejection(guardScoped(requestWith(planetId)));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({
        message: 'X-Planet-Id must be a planet id',
      });
    },
  );

  it('rejects an unknown planet with 404', async () => {
    const error = await rejection(
      guardScoped(requestWith('00000000-0000-0000-0000-000000000000')),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toMatchObject({
      message: 'This planet has drifted away',
    });
  });

  it('lets a known planet through and puts its id on the request', async () => {
    const req = requestWith(KNOWN_ID);

    await expect(guardScoped(req)).resolves.toBe(true);
    expect(req.planetId).toBe(KNOWN_ID);
  });

  it('accepts an upper-case id and stores it in lower case', async () => {
    const req = requestWith(KNOWN_ID.toUpperCase());

    await expect(guardScoped(req)).resolves.toBe(true);
    expect(req.planetId).toBe(KNOWN_ID);
  });
});
