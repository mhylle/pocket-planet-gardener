import { DOCUMENT, Injectable, inject } from '@angular/core';

/** Reloads the page; a service so specs can replace it. */
@Injectable({ providedIn: 'root' })
export class PageReloadService {
  private readonly document = inject(DOCUMENT);

  reload(): void {
    this.document.location.reload();
  }
}
