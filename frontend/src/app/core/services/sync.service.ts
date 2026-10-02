import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { hasStatus } from '../helpers/error-message';
import { CommandResponse, EventDto, SyncResponse } from '../models/planet-snapshot';
import { ApiService } from './api.service';
import { GameConfigService } from './game-config.service';
import { PlanetStore } from './planet-store.service';

/** A gameplay change for the server. */
export interface Command {
  method: 'POST' | 'PATCH' | 'DELETE';
  /** A path below /api, such as '/planet/sync'. */
  path: string;
  /** The command's fields; expectedVersion is added when the command is sent. */
  body: object;
}

/** The wait before retrying an unreachable server; it doubles on every miss, up to the cap. */
export const FIRST_RETRY_MS = 1000;
export const MAX_RETRY_MS = 30_000;

export const PLANET_CLOSED_MESSAGE = 'The planet was closed before this change was saved.';

/** No response at all (0), or the dev proxy reporting that the backend is down. */
const OFFLINE_STATUSES = [0, 502, 503, 504];

interface QueuedCommand {
  command: Command;
  resolve: (response: CommandResponse) => void;
  reject: (reason: unknown) => void;
}

/**
 * Saves the player's changes without a save button (ACC-03). Commands wait in a queue and go
 * one at a time, each naming the planet version current when it is sent. While the server is
 * unreachable the queue holds and retries with backoff. A heartbeat keeps the planet current
 * between commands (D-3). A 409 means another device changed the planet (ACC-04 AC2).
 * Commands and heartbeats share one lane, so a sync never races a command on the server.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(ApiService);
  private readonly store = inject(PlanetStore);
  private readonly config = inject(GameConfigService);

  private queue: QueuedCommand[] = [];
  private busy = false;
  private request: Subscription | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = FIRST_RETRY_MS;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly unlocks = new Subject<string[]>();
  private readonly happenings = new Subject<EventDto[]>();

  /**
   * The item types a command or sync response named as the player's for the first time
   * (ITM-04 AC3).
   */
  readonly newlyUnlocked = this.unlocks.asObservable();
  /**
   * What happened on the planet, as each command or sync response tells it, such as a want
   * fulfilled. Sent straight after the response's snapshot is stored.
   */
  readonly events = this.happenings.asObservable();

  /**
   * Queues a command. Resolves once the server applied it. Rejects with the HttpErrorResponse
   * when the server refused it (errorMessage() gives the player's line) or on a 409, which
   * also drops every queued command. Never rejects for being offline: it keeps retrying.
   */
  send(command: Command): Promise<CommandResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ command, resolve, reject });
      this.countPending();
      this.sendNext();
    });
  }

  /**
   * Syncs once straight away, such as when the planet opens, so a returning player sees what
   * changed without waiting for the first heartbeat (TIM-03).
   */
  syncNow(): void {
    this.beat();
  }

  /** Syncs every syncIntervalSeconds while nothing else is being saved. */
  startHeartbeat(): void {
    this.stopHeartbeat();
    this.scheduleHeartbeat();
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Stops everything for the current planet, so nothing reaches the next one. */
  reset(): void {
    this.stopHeartbeat();
    this.request?.unsubscribe();
    this.request = null;
    this.busy = false;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryDelay = FIRST_RETRY_MS;
    this.dropQueue(new Error(PLANET_CLOSED_MESSAGE));
  }

  private sendNext(): void {
    const head = this.queue[0];
    if (!head || this.busy || this.retryTimer !== null) {
      return;
    }
    const { method, path, body } = head.command;
    const payload = { ...body, expectedVersion: this.store.version() };
    this.dispatch(
      this.call<CommandResponse>(method, path, payload),
      (response) => {
        this.apply(response);
        this.queue.shift();
        this.countPending();
        head.resolve(response);
      },
      (error) => {
        if (isOffline(error)) {
          this.scheduleRetry();
        } else if (hasStatus(error, 409)) {
          this.dropQueue(error);
        } else {
          this.queue.shift();
          this.countPending();
          head.reject(error);
        }
      },
    );
  }

  private beat(): void {
    const version = this.store.version();
    if (this.busy || this.queue.length > 0 || version === null || this.store.reloadRequired()) {
      return;
    }
    this.dispatch(
      this.api.post<SyncResponse>('/planet/sync', { expectedVersion: version }),
      (response) => {
        this.apply(response);
        if (response.welcomeBack) {
          this.store.setWelcomeBack(response.welcomeBack);
        }
      },
      // A failed heartbeat has nothing to reject; offline and 409 are already recorded.
      () => undefined,
    );
  }

  /** Stores the response's snapshot, then passes on what it says is new. */
  private apply(response: SyncResponse): void {
    this.store.setSnapshot(response.snapshot);
    if (response.newlyUnlocked?.length) {
      this.unlocks.next(response.newlyUnlocked);
    }
    if (response.events.length) {
      this.happenings.next(response.events);
    }
  }

  /** Sends one request on the shared lane, records reachability and conflicts, then moves on. */
  private dispatch<T>(
    request: Observable<T>,
    onSuccess: (response: T) => void,
    onError: (error: unknown) => void,
  ): void {
    this.busy = true;
    this.request = request.subscribe({
      next: (response) => {
        this.settle(false);
        onSuccess(response);
        this.sendNext();
      },
      error: (error: unknown) => {
        this.settle(isOffline(error));
        if (hasStatus(error, 409)) {
          this.store.requireReload();
        }
        onError(error);
        this.sendNext();
      },
    });
  }

  private settle(offline: boolean): void {
    this.busy = false;
    this.request = null;
    this.store.setOffline(offline);
    if (!offline) {
      this.retryDelay = FIRST_RETRY_MS;
    }
  }

  private scheduleRetry(): void {
    const delay = this.retryDelay;
    this.retryDelay = Math.min(delay * 2, MAX_RETRY_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.sendNext();
    }, delay);
  }

  private scheduleHeartbeat(): void {
    // Read on every beat, so a config that loads after the planet still sets the pace.
    const seconds = this.config.config().syncIntervalSeconds;
    this.heartbeatTimer = setTimeout(() => {
      this.beat();
      this.scheduleHeartbeat();
    }, seconds * 1000);
  }

  private dropQueue(reason: unknown): void {
    const dropped = this.queue;
    this.queue = [];
    this.countPending();
    for (const queued of dropped) {
      queued.reject(reason);
    }
  }

  private countPending(): void {
    this.store.setPendingCommands(this.queue.length);
  }

  private call<T>(method: Command['method'], path: string, body: object): Observable<T> {
    switch (method) {
      case 'POST':
        return this.api.post<T>(path, body);
      case 'PATCH':
        return this.api.patch<T>(path, body);
      case 'DELETE':
        return this.api.delete<T>(path, body);
    }
  }
}

function isOffline(error: unknown): boolean {
  return error instanceof HttpErrorResponse && OFFLINE_STATUSES.includes(error.status);
}
