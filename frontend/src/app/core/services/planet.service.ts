import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { hasStatus } from '../helpers/error-message';
import { PlanetDto } from '../models/planet';
import { PlanetSnapshotDto } from '../models/planet-snapshot';
import { ApiService } from './api.service';
import { PlanetIdentityService } from './planet-identity.service';
import { PlanetStore } from './planet-store.service';
import { SyncService } from './sync.service';
import { ViewStateService } from './view-state.service';

export const DRIFTED_AWAY_NOTICE =
  'This planet has drifted away. You can start a new one here, or open another with its code.';

/**
 * The player's planet: create, open, rename, leave and delete (ACC-01, ACC-02, ACC-04, ACC-05).
 * The loaded planet lives in PlanetStore. Methods that call the server reject with the
 * HttpErrorResponse when the request fails.
 */
@Injectable({ providedIn: 'root' })
export class PlanetService {
  private readonly api = inject(ApiService);
  private readonly identity = inject(PlanetIdentityService);
  private readonly views = inject(ViewStateService);
  private readonly store = inject(PlanetStore);
  private readonly sync = inject(SyncService);
  private readonly currentNotice = signal<string | null>(null);

  /** A gentle line for the create-planet screen, such as why the stored planet did not open. */
  readonly notice = this.currentNotice.asReadonly();

  /** Creates the planet and switches to it; the planet page then loads its snapshot. */
  async create(name: string): Promise<void> {
    const planet = await firstValueFrom(this.api.post<PlanetDto>('/planet', { name: name.trim() }));
    this.open(planet.id);
  }

  /**
   * Fetches the stored planet into the store. When the server does not know it (404) or
   * cannot read the stored id (400), the id is forgotten and create-planet is shown with a
   * notice.
   */
  async load(): Promise<void> {
    try {
      this.store.setSnapshot(await firstValueFrom(this.api.get<PlanetSnapshotDto>('/planet')));
    } catch (error) {
      if (hasStatus(error, 404) || hasStatus(error, 400)) {
        this.forget(DRIFTED_AWAY_NOTICE);
        return;
      }
      throw error;
    }
  }

  /** Renames the planet, keeping the rest of the loaded snapshot. */
  async rename(name: string): Promise<void> {
    const renamed = await firstValueFrom(
      this.api.patch<PlanetDto>('/planet/name', { name: name.trim() }),
    );
    const current = this.store.snapshot();
    if (current) {
      this.store.setSnapshot({ ...current, ...renamed });
    }
  }

  /** Resolves a planet code to its planet and switches to it; the planet page then loads it. */
  async openByCode(code: string): Promise<void> {
    const path = '/planet/by-code/' + encodeURIComponent(code.trim().toUpperCase());
    const { id } = await firstValueFrom(this.api.get<{ id: string }>(path));
    this.open(id);
  }

  /** Forgets this planet on this device; it can be reopened with its code. */
  leave(): void {
    this.forget(null);
  }

  async deletePlanet(): Promise<void> {
    await firstValueFrom(this.api.delete<void>('/planet', { confirm: 'DELETE' }));
    this.forget(null);
  }

  private open(id: string): void {
    this.closeCurrent();
    this.identity.set(id);
    this.currentNotice.set(null);
    this.views.show('planet');
  }

  private forget(notice: string | null): void {
    this.closeCurrent();
    this.identity.clear();
    this.currentNotice.set(notice);
    this.views.show('create-planet');
  }

  /** Drops the planet shown so far and its unsaved commands, so none reach the next planet. */
  private closeCurrent(): void {
    this.sync.reset();
    this.store.clear();
  }
}
