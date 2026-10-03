import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JournalPageDto } from '../models/journal';
import { ApiService } from './api.service';

/**
 * The planet journal (JRN-03): its entries, newest first, a page at a time. Rejects with the
 * HttpErrorResponse when the request fails.
 */
@Injectable({ providedIn: 'root' })
export class JournalService {
  private readonly api = inject(ApiService);

  /** The newest entries, or the entries written before the given ISO timestamp. */
  page(before?: string): Promise<JournalPageDto> {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    return firstValueFrom(this.api.get<JournalPageDto>('/journal' + query));
  }
}
