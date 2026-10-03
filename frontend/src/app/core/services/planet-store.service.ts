import { Injectable, computed, signal } from '@angular/core';
import { PlanetSnapshotDto, WelcomeBack } from '../models/planet-snapshot';

/**
 * The single source of truth for the loaded planet and its save state. PlanetService fills it
 * when a planet opens; SyncService keeps it current and reports saving, offline, conflicts and
 * what changed while the player was away.
 */
@Injectable({ providedIn: 'root' })
export class PlanetStore {
  private readonly current = signal<PlanetSnapshotDto | null>(null);
  private readonly pending = signal(0);
  private readonly isOffline = signal(false);
  private readonly mustReload = signal(false);
  private readonly returned = signal<WelcomeBack | null>(null);

  readonly snapshot = this.current.asReadonly();
  /** The version every command must name; null until a planet is loaded. */
  readonly version = computed(() => this.current()?.version ?? null);
  /** Commands queued or on their way to the server. */
  readonly pendingCommands = this.pending.asReadonly();
  /** The server could not be reached on the last try (ACC-03 AC2, AC3). */
  readonly offline = this.isOffline.asReadonly();
  /** The planet changed on another device, so this copy must be reloaded (ACC-04 AC2). */
  readonly reloadRequired = this.mustReload.asReadonly();
  /**
   * The latest welcome-back summary from a sync (TIM-03) and its journal page (JRN-01); each
   * stays until the player dismisses it.
   */
  readonly welcomeBack = this.returned.asReadonly();

  setSnapshot(snapshot: PlanetSnapshotDto): void {
    this.current.set(snapshot);
  }

  setPendingCommands(count: number): void {
    this.pending.set(count);
  }

  setOffline(offline: boolean): void {
    this.isOffline.set(offline);
  }

  requireReload(): void {
    this.mustReload.set(true);
  }

  setWelcomeBack(welcomeBack: WelcomeBack): void {
    this.returned.set(welcomeBack);
  }

  /** Hides the summary lines; a journal page that came with them stays open. */
  dismissWelcomeBack(): void {
    this.returned.update((welcome) =>
      welcome?.journalEntry ? { summary: [], journalEntry: welcome.journalEntry } : null,
    );
  }

  /** Closes the journal page; the summary lines that came with it stay. */
  dismissJournalEntry(): void {
    this.returned.update((welcome) =>
      welcome?.summary.length ? { summary: welcome.summary } : null,
    );
  }

  /** Forgets the planet and its save state, such as when the player leaves it. */
  clear(): void {
    this.current.set(null);
    this.pending.set(0);
    this.isOffline.set(false);
    this.mustReload.set(false);
    this.returned.set(null);
  }
}
