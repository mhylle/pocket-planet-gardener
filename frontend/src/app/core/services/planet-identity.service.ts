import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'ppg.planetId';

/**
 * Which planet this browser plays (D-0: a player is a planet). The id lives in localStorage;
 * when storage is unavailable it is kept for this page load only.
 */
@Injectable({ providedIn: 'root' })
export class PlanetIdentityService {
  private readonly id = signal<string | null>(readStoredId());

  readonly planetId = this.id.asReadonly();

  set(id: string): void {
    this.id.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage is blocked or full; the signal still holds the id.
    }
  }

  clear(): void {
    this.id.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is blocked; the signal is already cleared.
    }
  }
}

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
