import type { PlanetPublicState } from '../ai/prompt-context';
import type { SpeciesId } from '../content/content.types';

/** A creature's name, personality, quirk, speaking style and short backstory (SD glossary, CRT-03). */
export interface CreatureIdentity {
  name: string;
  // Two or three short adjectives: the personality.
  traits: string[];
  // One sentence.
  quirk: string;
  // A short phrase, such as "grand and theatrical".
  speakingStyle: string;
  // At most three sentences, shown when the card is opened.
  backstory: string;
  // One line of at most 12 words for the card.
  summary: string;
}

/** Whether the model or the pre-written pool made an identity; kept for good (AIB-05 AC2). */
export type IdentitySource = 'ai' | 'fallback';

/** What IdentityService.create needs for a creature that is moving in. */
export interface IdentityRequest {
  species: SpeciesId;
  // Logged with the AI usage row only; never part of the prompt (AIB-02).
  planetId: string;
  planet: PlanetPublicState;
  // Names of the creatures already on the planet; a new name must differ (CRT-03 AC2).
  existingNames: string[];
  // Fallback names this planet has had before, so consecutive fallbacks differ.
  usedFallbackNames?: string[];
}

/** A new identity and who made it. */
export interface CreatedIdentity {
  identity: CreatureIdentity;
  source: IdentitySource;
}
