import { Component, inject, signal } from '@angular/core';
import { errorMessage } from '../../core/helpers/error-message';
import { AdminService } from '../../core/services/admin.service';

export const BUDGET_RULE = 'The budget must be a whole number, 0 or more.';

/**
 * The game owner's page, opened with ?admin=1: the global AI switch (ADM-01) and the daily AI
 * budget (ADM-02). Anyone can open it in the proof of concept (D-0), and the page says so.
 */
@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly admin = inject(AdminService);

  protected readonly settings = this.admin.settings;
  protected readonly loadError = signal<string | null>(null);
  protected readonly switchError = signal<string | null>(null);
  protected readonly budgetError = signal<string | null>(null);
  /** The last saved change, read out by screen readers. */
  protected readonly status = signal('');
  // Busy flags only ignore repeat presses; the controls stay enabled so keyboard focus stays put.
  private switching = false;
  private savingBudget = false;

  constructor() {
    void this.load();
  }

  /** Saves the opposite of the current state straight away, then shows what the server kept. */
  protected async toggleAi(): Promise<void> {
    const current = this.settings();
    if (!current || this.switching) {
      return;
    }
    this.switching = true;
    this.switchError.set(null);
    this.status.set('');
    try {
      await this.admin.update({ aiEnabled: !current.aiEnabled });
      this.status.set(
        this.settings()?.aiEnabled ? 'Saved: AI features are on.' : 'Saved: AI features are off.',
      );
    } catch (error) {
      this.switchError.set(errorMessage(error));
    } finally {
      this.switching = false;
    }
  }

  protected async saveBudget(event: Event, text: string): Promise<void> {
    event.preventDefault();
    if (this.savingBudget) {
      return;
    }
    this.status.set('');
    const budget = parseBudget(text);
    if (budget === null) {
      this.budgetError.set(BUDGET_RULE);
      return;
    }
    this.savingBudget = true;
    this.budgetError.set(null);
    try {
      await this.admin.update({ aiDailyBudget: budget });
      this.status.set(`Saved: the daily AI budget is ${this.settings()?.aiDailyBudget}.`);
    } catch (error) {
      this.budgetError.set(errorMessage(error));
    } finally {
      this.savingBudget = false;
    }
  }

  private async load(): Promise<void> {
    try {
      await this.admin.load();
    } catch (error) {
      this.loadError.set(errorMessage(error));
    }
  }
}

/** The typed budget as a whole number of 0 or more, or null for anything else ("-1", "2.5"). */
function parseBudget(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed)) ? Number(trimmed) : null;
}
