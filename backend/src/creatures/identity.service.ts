import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { RandomService } from '../common/random.service';
import { FALLBACK_IDENTITIES } from '../content/fallback-identities';
import {
  buildIdentityPrompt,
  identityProblems,
  identityTexts,
  parseIdentity,
} from './identity-prompt';
import type {
  CreatedIdentity,
  CreatureIdentity,
  IdentityRequest,
} from './identity.types';

/**
 * Creates the identity of a creature that is moving in (CRT-03): asked of
 * the model through the gateway and checked against the identity and content
 * rules, otherwise taken from the pre-written pool (AIB-05).
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly random: RandomService,
  ) {}

  /** Never throws; can take up to the AI timeout (see AiGatewayService.generate). */
  async create(request: IdentityRequest): Promise<CreatedIdentity> {
    const { species, planet, existingNames } = request;
    const result = await this.gateway.generate<CreatureIdentity>({
      feature: 'identity',
      planetId: request.planetId,
      messages: buildIdentityPrompt({ species, planet, existingNames }),
      parse: parseIdentity,
      validate: (identity) => identityProblems(identity, existingNames),
      texts: identityTexts,
      fallback: () => this.fallback(request),
    });
    return { identity: result.value, source: result.source };
  }

  /**
   * A random pre-written identity for the species whose name is neither on
   * the planet nor among its earlier fallbacks; when every one has been
   * used, any whose name is not on the planet.
   */
  private fallback(request: IdentityRequest): CreatureIdentity {
    const onPlanet = lowerCased(request.existingNames);
    const usedBefore = lowerCased(request.usedFallbackNames ?? []);
    const pool = FALLBACK_IDENTITIES[request.species];
    const allowed = pool.filter(
      (identity) => !onPlanet.has(identity.name.toLowerCase()),
    );
    const unused = allowed.filter(
      (identity) => !usedBefore.has(identity.name.toLowerCase()),
    );
    const choice = this.random.pick(
      unused.length > 0 ? unused : allowed.length > 0 ? allowed : pool,
    );
    // A copy, so a caller can never change the pool.
    return { ...choice, traits: [...choice.traits] };
  }
}

function lowerCased(names: readonly string[]): Set<string> {
  return new Set(names.map((name) => name.trim().toLowerCase()));
}
