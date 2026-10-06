import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { PlanetIdentityService } from './planet-identity.service';

export type View = 'create-planet' | 'planet' | 'admin';

/** Which screen the single-page app shows (D-6: no router). */
@Injectable({ providedIn: 'root' })
export class ViewStateService {
  private readonly document = inject(DOCUMENT);
  private readonly identity = inject(PlanetIdentityService);
  private readonly current = signal<View>(this.initialView());
  /** False once the page has shown a view other than the one it opened on. */
  private onFirstView = true;

  readonly view = this.current.asReadonly();

  /** True while the page still shows the planet it opened on, as for a returning player. */
  get returning(): boolean {
    return this.onFirstView && this.current() === 'planet';
  }

  show(view: View): void {
    this.onFirstView &&= view === this.current();
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
