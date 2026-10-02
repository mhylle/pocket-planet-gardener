import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { ClockService } from '../common/clock.service';
import { CreatureMemory } from '../creatures/creature-memory.entity';
import type { CreatureIdentity } from '../creatures/identity.types';
import {
  buildHighlightMessages,
  HIGHLIGHT_LIMITS,
  NO_HIGHLIGHT,
  type ChatTurn,
} from './creature-prompt';

/** How many of its latest memories a creature chats with. */
export const MEMORIES_PER_CHAT = 8;

/** What extractHighlight needs: whose chat it is and its recent turns. */
export interface HighlightRequest {
  // Logged with the AI usage row only; never part of the prompt (AIB-02).
  planetId: string;
  creatureId: string;
  identity: CreatureIdentity;
  // Oldest first, the new exchange last.
  turns: readonly ChatTurn[];
}

/** A highlight as read from the reply: its sentence, or null for "nothing worth keeping". */
interface Highlight {
  text: string | null;
}

/**
 * What a creature remembers (CHT-02): the memories its chats are written
 * with, and the highlights it keeps of them, one now and then rather than
 * every message (AC4).
 */
@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(CreatureMemory)
    private readonly memories: Repository<CreatureMemory>,
    private readonly gateway: AiGatewayService,
    private readonly clock: ClockService,
  ) {}

  /** Its latest memories of every kind, newest first and capped. */
  async memoriesFor(creatureId: string): Promise<string[]> {
    const rows = await this.memories.find({
      where: { creatureId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: MEMORIES_PER_CHAT,
    });
    return rows.map((memory) => memory.text);
  }

  /**
   * Asks the model for one short third-person highlight of the recent turns
   * and keeps it as a chat memory. Keeps nothing when the model finds
   * nothing worth remembering or the gateway falls back. Never throws; can
   * take up to the AI timeout.
   */
  async extractHighlight(request: HighlightRequest): Promise<string | null> {
    const result = await this.gateway.generate<Highlight>({
      feature: 'memory',
      planetId: request.planetId,
      messages: buildHighlightMessages({
        identity: request.identity,
        history: request.turns,
      }),
      parse: parseHighlight,
      texts: (highlight) => (highlight.text ? [highlight.text] : []),
      limits: HIGHLIGHT_LIMITS,
      fallback: () => ({ text: null }),
    });
    const { text } = result.value;
    if (result.source !== 'ai' || !text) {
      return null;
    }
    await this.memories.insert({
      creatureId: request.creatureId,
      kind: 'chat',
      text,
      createdAt: this.clock.now(),
    });
    return text;
  }
}

/** The trimmed sentence, without wrapping quotes; null text for NONE; null for an empty reply. */
function parseHighlight(reply: string): Highlight | null {
  const text = reply
    .trim()
    .replace(/^["'“]+|["'”]+$/g, '')
    .trim();
  if (text === '') {
    return null;
  }
  if (text.replace(/[.!]+$/, '').toUpperCase() === NO_HIGHLIGHT) {
    return { text: null };
  }
  // The creature_memories column holds 400 characters.
  return text.length <= 400 ? { text } : null;
}
