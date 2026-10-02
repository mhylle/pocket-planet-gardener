import { Injectable, Logger } from '@nestjs/common';
import { AdminSettingsService } from '../admin/admin-settings.service';
import { AiUsageService } from '../admin/ai-usage.service';
import { GameConfigService } from '../game-config/game-config.service';
import type { AiFallbackReason, AiRequest, AiResult } from './ai-gateway.types';
import { AiService } from './ai.service';
import type { ChatMessage } from './ai.types';
import { checkText, type TextLimits, type Violation } from './content-rules';

const TIMED_OUT = Symbol('timed out');

/** What asking the model came to: a usable value, or why there is none. */
type Attempt<T> =
  { ok: true; value: T } | { ok: false; reason: AiFallbackReason };

/** One reply read and checked: its value, or what is wrong with it. */
type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] };

/**
 * The only path to the model (D-4). In order: the AI switch (ADM-01), the
 * daily budget (ADM-02), the call raced against the AI timeout (AIB-04),
 * reading the reply and checking it against the content rules, one retry
 * that names the problem (AIB-01 AC2), and otherwise the request's fallback
 * (AIB-05). Every call logs one ai_usage row.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly ai: AiService,
    private readonly settings: AdminSettingsService,
    private readonly usage: AiUsageService,
    private readonly config: GameConfigService,
  ) {}

  /**
   * The model's content for the request, or its fallback. Never throws,
   * unless the fallback itself does. It can take up to the AI timeout;
   * called inside mutate(), other commands on that planet wait that long.
   */
  async generate<T>(req: AiRequest<T>): Promise<AiResult<T>> {
    // A duration, not a time of day, so not from ClockService.
    const started = performance.now();
    const attempt = await this.attempt(req);
    const result: AiResult<T> = attempt.ok
      ? { value: attempt.value, source: 'ai' }
      : {
          value: await req.fallback(),
          source: 'fallback',
          reason: attempt.reason,
        };
    await this.record(req, result, performance.now() - started);
    return result;
  }

  private async attempt<T>(req: AiRequest<T>): Promise<Attempt<T>> {
    try {
      if (!(await this.settings.aiEnabled())) {
        return { ok: false, reason: 'disabled' };
      }
      const [used, budget] = await Promise.all([
        this.usage.countToday(),
        this.settings.aiDailyBudget(),
      ]);
      if (used >= budget) {
        return { ok: false, reason: 'budget' };
      }
      return await this.ask(req);
    } catch (error) {
      this.logger.warn(`AI ${req.feature} failed: ${messageOf(error)}`);
      return { ok: false, reason: 'error' };
    }
  }

  /** At most two calls to the model, both within one AI timeout. */
  private async ask<T>(req: AiRequest<T>): Promise<Attempt<T>> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), this.config.aiTimeoutMs);
    });
    const call = (messages: ChatMessage[]) =>
      Promise.race([this.ai.complete(messages), timeout]);

    try {
      const first = await call(req.messages);
      if (first === TIMED_OUT) {
        return this.timedOut(req.feature);
      }
      const checked = this.check(req, first);
      if (checked.ok) {
        return checked;
      }

      const second = await call([
        ...req.messages,
        correction(checked.problems),
      ]);
      if (second === TIMED_OUT) {
        return this.timedOut(req.feature);
      }
      const rechecked = this.check(req, second);
      if (rechecked.ok) {
        return rechecked;
      }
      this.logger.warn(
        `AI ${req.feature} replied unusably twice: ${rechecked.problems.join('; ')}`,
      );
      return { ok: false, reason: 'invalid' };
    } finally {
      clearTimeout(timer);
    }
  }

  private timedOut(feature: string): Attempt<never> {
    this.logger.warn(
      `AI ${feature} timed out after ${this.config.aiTimeoutMs} ms`,
    );
    return { ok: false, reason: 'timeout' };
  }

  /** Reads the reply and lists what breaks the request's checks or the content rules. */
  private check<T>(req: AiRequest<T>, reply: string): Checked<T> {
    try {
      const value = req.parse(reply);
      if (value === null) {
        return { ok: false, problems: [WRONG_FORM] };
      }
      const problems = new Set(req.validate?.(value) ?? []);
      for (const text of req.texts?.(value) ?? []) {
        for (const violation of checkText(text, req.limits)) {
          problems.add(describe(violation, req.limits));
        }
      }
      return problems.size === 0
        ? { ok: true, value }
        : { ok: false, problems: [...problems] };
    } catch {
      // A reply of an unexpected shape can trip parse, validate or texts.
      return { ok: false, problems: [WRONG_FORM] };
    }
  }

  private async record<T>(
    req: AiRequest<T>,
    result: AiResult<T>,
    latencyMs: number,
  ): Promise<void> {
    try {
      await this.usage.record({
        feature: req.feature,
        planetId: req.planetId ?? null,
        usedFallback: result.source === 'fallback',
        reason: result.reason ?? null,
        latencyMs: Math.round(latencyMs),
      });
    } catch (error) {
      // The player still gets the content; only the log row is lost.
      this.logger.error(
        `Could not log AI usage for ${req.feature}: ${messageOf(error)}`,
      );
    }
  }
}

const WRONG_FORM = 'it was not in the requested format';

/** The violation in words the model can act on. */
function describe(violation: Violation, limits: TextLimits = {}): string {
  if (violation === 'too-long') {
    return `it was longer than ${limits.maxWords} words`;
  }
  if (violation === 'too-many-sentences') {
    return `it had more than ${limits.maxSentences} sentences`;
  }
  return violation.replaceAll('-', ' ');
}

/** The user message added for the retry, naming what was wrong. */
function correction(problems: string[]): ChatMessage {
  return {
    role: 'user',
    content: `Your reply could not be used: ${problems.join('; ')}. Please answer again and follow every instruction.`,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The first JSON object or array in a model reply, which may wrap it in a
 * code fence or in prose; null when there is none. For a request's parse.
 */
export function extractJson(text: string): unknown {
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{' && text[start] !== '[') {
      continue;
    }
    const end = closingBracket(text, start);
    if (end < 0) {
      continue;
    }
    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch {
      // Brackets in prose, such as "[sic]": look further on.
    }
  }
  return null;
}

/** The index of the bracket that closes the one at start, skipping strings; -1 if none. */
function closingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') {
        i++;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}
