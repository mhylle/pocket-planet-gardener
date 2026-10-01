import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { PlanetIdentityService } from './planet-identity.service';

export type View = 'create-planet' | 'planet' | 'admin';

/** Which screen the single-page app shows (D-6: no router). */
@Injectable({ providedIn: 'root' })
export class ViewStateService {
  private readonly document = inject(DOCUMENT);
  private readonly identity = inject(PlanetIdentityService);
  private readonly current = signal<View>(this.initialView());

  readonly view = this.current.asReadonly();

  show(view: View): void {
    this.current.set(view);
  }

  /** The admin view opens with ?admin=1 (D-0); otherwise a known planet opens directly. */
  private initialView(): View {
    if (new URLSearchParams(this.document.location.search).get('admin') === '1') {
      return 'admin';
    }
    return this.identity.planetId() ? 'planet' : 'create-planet';
  }
}
