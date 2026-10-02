import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminSettings, AdminSettingsChange } from '../models/admin-settings';
import { ApiService } from './api.service';

/**
 * The game owner's settings: the global AI switch and the daily AI budget (ADM-01, ADM-02).
 * The endpoints are open in the proof of concept (D-0). Methods reject with the
 * HttpErrorResponse when the request fails, and the last saved settings stay.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);
  private readonly current = signal<AdminSettings | null>(null);

  /** The settings as the server last reported them; null until they have loaded. */
  readonly settings = this.current.asReadonly();

  async load(): Promise<void> {
    this.current.set(await firstValueFrom(this.api.get<AdminSettings>('/admin/settings')));
  }

  async update(change: AdminSettingsChange): Promise<void> {
    this.current.set(
      await firstValueFrom(this.api.patch<AdminSettings>('/admin/settings', change)),
    );
  }
}
