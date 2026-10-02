import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Not, type Repository } from 'typeorm';
import { AiUsage } from '../admin/ai-usage.entity';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { toPlanetPublicState, toPublicEvents } from '../ai/prompt-context';
import { ClockService } from '../common/clock.service';
import { RandomService } from '../common/random.service';
import {
  greetingFor,
  kindLine,
  napLine,
  sleepyLine,
} from '../content/chat-lines';
import { CreatureMemory } from '../creatures/creature-memory.entity';
import { Creature } from '../creatures/creature.entity';
import { PlanetEvent } from '../events/event.entity';
import { GameConfigService } from '../game-config/game-config.service';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import { ChatMessage } from './chat-message.entity';
import {
  isHighlightTurn,
  messageLength,
  nextStamp,
  parseAnswer,
  remainingToday,
  startOfUtcDay,
} from './chat-rules';
import {
  buildChatMessages,
  CHAT_HISTORY_TURNS,
  type ChatTurn,
} from './creature-prompt';
import type {
  ChatHistoryDto,
  ChatMessageDto,
  ChatSendResultDto,
} from './dto/chat-message.dto';
import { MemoryService } from './memory.service';
import { detectDistress } from './wellbeing';

const NOT_HERE = "That creature isn't on your planet.";

/** The gateway feature of an answer; its usage rows are the daily count. */
const CHAT_FEATURE = 'chat';

/** The calm, out-of-character notice for a player who may be in danger (AIB-03 AC2). */
export const WELLBEING_NOTICE =
  "If you're having a hard time, you don't have to deal with it alone. Talking to someone you trust, or a support line, can really help.";
export const HELPLINE_LABEL = 'Find a helpline';

/** A page of history when the client asks for no size. */
const DEFAULT_PAGE = 30;

/** How many of the planet's latest notable events a chat knows about (CHT-02 AC3). */
const RECENT_EVENTS = 8;

/** Growth steps are not news worth chatting about; blooms are. */
const QUIET_EVENT = 'plant-stage';

/**
 * "At most about 60 words" (CHT-01 AC2): the prompt asks for at most
 * chatAnswerMaxWords, and an answer up to this much longer still counts.
 * No sentence cap: a chatty creature's short exclamations are fine.
 */
const WORD_TOLERANCE = 1.25;

/**
 * Chatting with a creature (CHT-01..04, AIB-03). Not a gameplay command:
 * a chat neither changes the planet nor its version, so it never goes
 * through mutate() and the model is never asked while the planet row is
 * locked. Every route checks that the creature lives on the planet.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
    @InjectRepository(Creature)
    private readonly creatures: Repository<Creature>,
    @InjectRepository(PlanetEvent)
    private readonly events: Repository<PlanetEvent>,
    @InjectRepository(AiUsage)
    private readonly usage: Repository<AiUsage>,
    private readonly planetState: PlanetStateService,
    private readonly gateway: AiGatewayService,
    private readonly memory: MemoryService,
    private readonly config: GameConfigService,
    private readonly clock: ClockService,
    private readonly random: RandomService,
  ) {}

  /**
   * One page of the chat, oldest first: the limit messages before before,
   * or the latest ones (CHT-04 AC1). Comes with a scripted greeting and the
   * messages left today.
   */
  async history(
    planetId: string,
    creatureId: string,
    before?: string,
    limit = DEFAULT_PAGE,
  ): Promise<ChatHistoryDto> {
    const creature = await this.creatureOn(planetId, creatureId);
    const rows = await this.messages.find({
      where: {
        creatureId,
        ...(before ? { createdAt: LessThan(new Date(before)) } : {}),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit + 1,
    });
    const used = await this.usedToday(planetId);
    return {
      messages: rows
        .slice(0, limit)
        .reverse()
        .map((message) => this.toDto(message)),
      hasMore: rows.length > limit,
      remaining: remainingToday(this.config.chatDailyLimit, used),
      greeting: greetingFor(creature.species, creature.name, this.random),
    };
  }

  /**
   * The player says something and the creature answers (CHT-01). Over the
   * daily limit, only a sleepy line that is not stored and no model call
   * (CHT-03 AC1). Otherwise the player's message is always kept, a notice
   * with a helpline link follows a message that suggests danger (AIB-03
   * AC2), and the answer comes from the model or, failing that, a napping
   * line (AC4). Every 5th message the creature keeps a highlight (CHT-02
   * AC4). Can take up to twice the AI timeout on such a message.
   */
  async send(
    planetId: string,
    creatureId: string,
    rawText: string,
  ): Promise<ChatSendResultDto> {
    const creature = await this.creatureOn(planetId, creatureId);
    const text = this.checkedText(rawText);
    const limit = this.config.chatDailyLimit;
    const used = await this.usedToday(planetId);
    if (used >= limit) {
      return {
        messages: [
          {
            // Never stored, so the id is made here.
            id: randomUUID(),
            role: 'creature',
            text: sleepyLine(creature.name),
            createdAt: this.clock.now().toISOString(),
            source: 'scripted',
          },
        ],
        remaining: 0,
        limitReached: true,
      };
    }

    const latest = await this.messages.find({
      where: { creatureId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: CHAT_HISTORY_TURNS + 2,
    });
    const history: ChatTurn[] = latest
      .filter((message) => message.role !== 'notice')
      .slice(0, CHAT_HISTORY_TURNS)
      .reverse()
      .map(toTurn);
    let stamp = latest[0]?.createdAt;
    const store = (
      message: Pick<ChatMessage, 'role' | 'text' | 'source'>,
    ): Promise<ChatMessage> => {
      stamp = nextStamp(this.clock.now(), stamp);
      return this.messages.save(
        this.messages.create({
          ...message,
          creatureId,
          planetId,
          createdAt: stamp,
        }),
      );
    };

    const added = [await store({ role: 'user', text, source: null })];
    const distress = detectDistress(text);
    if (distress === 'danger') {
      added.push(
        await store({
          role: 'notice',
          text: WELLBEING_NOTICE,
          source: 'scripted',
        }),
      );
    }

    const identity = { ...creature.identity, name: creature.name };
    const memories = await this.memory.memoriesFor(creatureId);
    const events = await this.events.find({
      where: { planetId, type: Not(QUIET_EVENT) },
      order: { occurredAt: 'DESC', id: 'DESC' },
      take: RECENT_EVENTS,
    });
    const snapshot = await this.planetState.getSnapshot(planetId);
    const maxWords = this.config.chatAnswerMaxWords;
    const answer = await this.gateway.generate<string>({
      feature: CHAT_FEATURE,
      planetId,
      messages: buildChatMessages({
        species: creature.species,
        identity,
        mood: creature.mood,
        wistful: creature.wistful,
        memories,
        // Oldest first, as they happened.
        recentEvents: toPublicEvents(events.reverse()),
        planet: toPlanetPublicState(snapshot),
        history,
        userText: text,
        distress,
        maxWords,
      }),
      parse: parseAnswer,
      texts: (reply) => [reply],
      limits: { maxWords: Math.round(maxWords * WORD_TOLERANCE) },
      fallback: () =>
        distress === 'danger'
          ? kindLine(creature.name)
          : napLine(creature.name),
    });
    const reply = await store({
      role: 'creature',
      text: answer.value,
      source: answer.source,
    });
    added.push(reply);

    // A fallback means the model is away, so the highlight would only wait
    // for it too; the next 5th message tries again.
    if (
      answer.source === 'ai' &&
      isHighlightTurn(await this.messages.countBy({ creatureId, role: 'user' }))
    ) {
      await this.memory.extractHighlight({
        planetId,
        creatureId,
        identity,
        turns: [...history, toTurn(added[0]), toTurn(reply)].slice(
          -CHAT_HISTORY_TURNS,
        ),
      });
    }

    return {
      messages: added.map((message) => this.toDto(message)),
      remaining: remainingToday(limit, used + 1),
      limitReached: false,
    };
  }

  /**
   * "Forget our chats" (CHT-04 AC2): the chat and the highlights kept of it
   * go; memories of wants, events and stories stay. The next answer is
   * written without any of it (AC3).
   */
  async forget(planetId: string, creatureId: string): Promise<void> {
    await this.creatureOn(planetId, creatureId);
    await this.messages.manager.transaction(async (em) => {
      await em.delete(ChatMessage, { creatureId });
      await em.delete(CreatureMemory, { creatureId, kind: 'chat' });
    });
  }

  private async creatureOn(
    planetId: string,
    creatureId: string,
  ): Promise<Creature> {
    const creature = await this.creatures.findOneBy({
      id: creatureId,
      planetId,
    });
    if (!creature) {
      throw new NotFoundException(NOT_HERE);
    }
    return creature;
  }

  /** The trimmed message, or a friendly 400 when it is empty or too long. */
  private checkedText(rawText: string): string {
    const text = rawText.trim();
    const max = this.config.chatMessageMaxChars;
    const length = messageLength(text);
    if (length === 0 || length > max) {
      throw new BadRequestException({
        statusCode: 400,
        message:
          length === 0
            ? 'Type something to say first.'
            : `That's a lot to say at once! Keep it to ${max} characters.`,
        reason: length === 0 ? 'empty' : 'too-long',
      });
    }
    return text;
  }

  /**
   * The player's messages today, across all the planet's creatures (CHT-03).
   * Counted from the AI usage log, not the chat: every message within the
   * limit makes exactly one chat gateway call, which logs one row even when
   * it falls back, and forgetting the chats leaves the log alone, so it
   * cannot give messages back.
   */
  private usedToday(planetId: string): Promise<number> {
    return this.usage.countBy({
      feature: CHAT_FEATURE,
      planetId,
      createdAt: MoreThanOrEqual(startOfUtcDay(this.clock.now())),
    });
  }

  private toDto(message: ChatMessage): ChatMessageDto {
    return {
      id: message.id,
      role: message.role,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      ...(message.source ? { source: message.source } : {}),
      ...(message.role === 'notice'
        ? { link: { label: HELPLINE_LABEL, url: this.config.supportUrl } }
        : {}),
    };
  }
}

function toTurn(message: ChatMessage): ChatTurn {
  return {
    role: message.role === 'user' ? 'user' : 'creature',
    text: message.text,
  };
}
