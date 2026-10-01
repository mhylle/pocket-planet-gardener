import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { hasStatus } from '../helpers/error-message';
import { PlanetDto } from '../models/planet';
import { ApiService } from './api.service';
import { PlanetIdentityService } from './planet-identity.service';
import { ViewStateService } from './view-state.service';

export const DRIFTED_AWAY_NOTICE =
  'This planet has drifted away. You can start a new one here, or open another with its code.';

/**
 * The player's planet: create, open, rename, leave and delete (ACC-01, ACC-02, ACC-04, ACC-05).
 * Methods that call the server reject with the HttpErrorResponse when the request fails.
 */
@Injectable({ providedIn: 'root' })
export class PlanetService {
  private readonly api = inject(ApiService);
  private readonly identity = inject(PlanetIdentityService);
  private readonly views = inject(ViewStateService);
  private readonly current = signal<PlanetDto | null>(null);
  private readonly currentNotice = signal<string | null>(null);

  readonly planet = this.current.asReadonly();
  /** A gentle line for the create-planet screen, such as why the stored planet did not open. */
  readonly notice = this.currentNotice.asReadonly();

  async create(name: string): Promise<void> {
    const planet = await firstValueFrom(this.api.post<PlanetDto>('/planet', { name: name.trim() }));
    this.open(planet.id, planet);
  }

  /**
   * Fetches the stored planet. When the server does not know it (404) or cannot read the
   * stored id (400), the id is forgotten and create-planet is shown with a notice.
   */
  async load(): Promise<void> {
    try {
      this.current.set(await firstValueFrom(this.api.get<PlanetDto>('/planet')));
    } catch (error) {
      if (hasStatus(error, 404) || hasStatus(error, 400)) {
        this.forget(DRIFTED_AWAY_NOTICE);
        return;
      }
      throw error;
    }
  }

  async rename(name: string): Promise<void> {
    this.current.set(
      await firstValueFrom(this.api.patch<PlanetDto>('/planet/name', { name: name.trim() })),
    );
  }

  /** Resolves a planet code to its planet and switches to it; the planet page then loads it. */
  async openByCode(code: string): Promise<void> {
    const path = '/planet/by-code/' + encodeURIComponent(code.trim().toUpperCase());
    const { id } = await firstValueFrom(this.api.get<{ id: string }>(path));
    this.open(id, null);
  }

  /** Forgets this planet on this device; it can be reopened with its code. */
  leave(): void {
    this.forget(null);
  }

  async deletePlanet(): Promise<void> {
    await firstValueFrom(this.api.delete<void>('/planet', { confirm: 'DELETE' }));
    this.forget(null);
  }

  private open(id: string, planet: PlanetDto | null): void {
    this.identity.set(id);
    this.current.set(planet);
    this.currentNotice.set(null);
    this.views.show('planet');
  }

  private forget(notice: string | null): void {
    this.identity.clear();
    this.current.set(null);
    this.currentNotice.set(notice);
    this.views.show('create-planet');
  }
}
