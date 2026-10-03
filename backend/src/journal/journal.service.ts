import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { toPlanetPublicState, toPublicEvents } from '../ai/prompt-context';
import { PLANTS } from '../content/plants';
import type { PlanetEvent } from '../events/event.entity';
import { EventLogService } from '../events/event-log.service';
import { ReturnService } from '../events/return.service';
import { GameConfigService } from '../game-config/game-config.service';
import type { MutationContext } from '../planets/planet-state/mutation.types';
import { PlanetStateService } from '../planets/planet-state/planet-state.service';
import type {
  JournalEntryDto,
  JournalMilestoneDto,
  JournalPageDto,
} from './dto/journal-entry.dto';
import { JournalEntry } from './journal-entry.entity';
import {
  dateRng,
  journalDate,
  templateEntry,
  verify,
  type JournalFacts,
} from './journal-fact-check';
import {
  buildJournalPrompt,
  describeViolations,
  parseJournal,
} from './journal-prompt';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** A page of the book when the client asks for no size. */
const DEFAULT_PAGE = 10;

/**
 * "About 150 words" (JRN-01 AC1): the prompt asks for at most
 * journalMaxWords, and an entry up to this much longer still counts.
 */
const WORD_TOLERANCE = 1.25;

const PLANT_NAMES = new Map<string, string>(
  PLANTS.map((plant) => [plant.id, plant.name.toLowerCase()]),
);

/**
 * The planet's journal (JRN-01..03). On a sync after journalAfterHours or
 * more away it writes one entry about the events logged since the previous
 * one: by the model through the gateway, checked against the facts, or else
 * from the template (AIB-05). The entry is returned in welcomeBack and kept
 * for the book.
 */
@Injectable()
export class JournalService implements OnModuleInit {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly entries: Repository<JournalEntry>,
    private readonly planetState: PlanetStateService,
    private readonly eventLog: EventLogService,
    private readonly returns: ReturnService,
    private readonly gateway: AiGatewayService,
    private readonly config: GameConfigService,
  ) {}

  onModuleInit(): void {
    this.returns.registerJournalWriter((ctx, previousLastSeenAt) =>
      this.writeIfDue(ctx, previousLastSeenAt),
    );
  }

  /**
   * Writes and returns the entry when the player was away journalAfterHours
   * or more and the planet has no entry from that long ago or less (JRN-01
   * AC4); otherwise undefined. Runs inside the sync, so it can take up to
   * the AI timeout (see AiGatewayService.generate).
   */
  async writeIfDue(
    ctx: MutationContext,
    previousLastSeenAt: Date,
  ): Promise<JournalEntryDto | undefined> {
    const { em, planet, now } = ctx;
    const after = this.config.journalAfterHours * HOUR_MS;
    if (now.getTime() - previousLastSeenAt.getTime() < after) {
      return undefined;
    }
    const previous = await em.findOne(JournalEntry, {
      where: { planetId: planet.id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    if (previous && now.getTime() - previous.createdAt.getTime() < after) {
      return undefined;
    }

    // From where the previous entry stopped, at most maxAwayDays back.
    const earliest = new Date(now.getTime() - this.config.maxAwayDays * DAY_MS);
    const coversFrom =
      previous && previous.coversTo > earliest ? previous.coversTo : earliest;
    const events = await this.eventLog.since(planet.id, coversFrom, em);
    const snapshot = await this.planetState.getSnapshot(planet.id, em);
    const facts: JournalFacts = {
      events,
      creatureNames: (snapshot.creatures ?? []).map(({ name }) => name),
      planetName: planet.name,
      maxWords: Math.round(this.config.journalMaxWords * WORD_TOLERANCE),
    };

    const result = await this.gateway.generate<string>({
      feature: 'journal',
      planetId: planet.id,
      messages: buildJournalPrompt({
        date: journalDate(now),
        planet: toPlanetPublicState(snapshot),
        events: toPublicEvents(events),
        maxWords: this.config.journalMaxWords,
      }),
      parse: parseJournal,
      validate: (text) => describeViolations(verify(text, facts)),
      texts: (text) => [text],
      limits: { maxWords: facts.maxWords },
      fallback: () => templateEntry(events, facts, now, dateRng(now)),
    });

    const entry = await em.save(
      em.create(JournalEntry, {
        planetId: planet.id,
        text: result.value,
        source: result.source === 'ai' ? 'ai' : 'template',
        coversFrom,
        coversTo: now,
        createdAt: now,
      }),
    );
    return toJournalEntryDto(
      entry,
      events.filter((event) => event.isMilestone),
    );
  }

  /** A page of the book, newest first: the latest entries, or those before before (JRN-03 AC1). */
  async list(
    planetId: string,
    before?: string,
    limit = DEFAULT_PAGE,
  ): Promise<JournalPageDto> {
    const rows = await this.entries.find({
      where: {
        planetId,
        ...(before ? { createdAt: LessThan(new Date(before)) } : {}),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    if (page.length === 0) {
      return { entries: [], hasMore: false };
    }
    // Entries never overlap, so one read covers every page's milestones.
    const milestones = await this.eventLog.milestones(
      planetId,
      page[page.length - 1].coversFrom,
      page[0].coversTo,
    );
    return {
      entries: page.map((entry) =>
        toJournalEntryDto(
          entry,
          milestones.filter(
            (event) =>
              event.occurredAt > entry.coversFrom &&
              event.occurredAt <= entry.coversTo,
          ),
        ),
      ),
      hasMore: rows.length > limit,
    };
  }
}

/** An entry as the client sees it, with the milestones it covers. */
function toJournalEntryDto(
  entry: JournalEntry,
  milestones: readonly PlanetEvent[],
): JournalEntryDto {
  return {
    id: entry.id,
    text: entry.text,
    source: entry.source,
    createdAt: entry.createdAt.toISOString(),
    coversFrom: entry.coversFrom.toISOString(),
    coversTo: entry.coversTo.toISOString(),
    milestones: milestones.map(toMilestoneDto),
  };
}

/** "First bloom: clover", "Wigglenut the worm moved in". */
function toMilestoneDto(event: PlanetEvent): JournalMilestoneDto {
  const { type, name, species } = event.payload;
  let label: string;
  if (event.type === 'plant-bloomed') {
    label = `First bloom: ${(typeof type === 'string' && PLANT_NAMES.get(type)) || 'a flower'}`;
  } else if (
    event.type === 'creature-arrived' &&
    typeof name === 'string' &&
    typeof species === 'string'
  ) {
    label = `${name} the ${species} moved in`;
  } else {
    label = event.type.replace(/-/g, ' ');
  }
  return {
    type: event.type,
    label,
    occurredAt: event.occurredAt.toISOString(),
  };
}
