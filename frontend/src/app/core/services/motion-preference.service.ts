import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether to keep motion to a minimum (SET-03, NAV-04 AC3): the player's setting when it is on
 * or off, otherwise what the device asks for, followed live. Everything that moves asks this,
 * so a change applies everywhere at once: idle animation, camera swoops and spin, and
 * celebrations, which then stand still or only fade.
 */
@Injectable({ providedIn: 'root' })
export class MotionPreferenceService {
  private readonly settings = inject(SettingsService).settings;
  private readonly deviceAsks = signal(false);

  readonly reduced = computed(() => {
    const choice = this.settings().reducedMotion;
    return choice === 'auto' ? this.deviceAsks() : choice === 'on';
  });

  constructor() {
    // jsdom, where the specs run, has no matchMedia.
    if (typeof matchMedia !== 'function') {
      return;
    }
    const query = matchMedia(REDUCED_MOTION_QUERY);
    this.deviceAsks.set(query.matches);
    const follow = (event: MediaQueryListEvent) => this.deviceAsks.set(event.matches);
    query.addEventListener('change', follow);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', follow));
  }
}
