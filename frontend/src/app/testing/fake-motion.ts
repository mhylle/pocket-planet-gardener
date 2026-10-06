import { Injectable, Provider, signal } from '@angular/core';
import { MotionPreferenceService } from '../core/services/motion-preference.service';

/** Stands in for MotionPreferenceService: the spec says whether motion is reduced. */
@Injectable()
export class FakeMotionPreference {
  readonly reduced = signal(false);
}

/** Provides a FakeMotionPreference as the MotionPreferenceService; inject it to set it. */
export const FAKE_MOTION_PROVIDERS: Provider[] = [
  FakeMotionPreference,
  { provide: MotionPreferenceService, useExisting: FakeMotionPreference },
];
