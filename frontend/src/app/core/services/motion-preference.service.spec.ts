import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_PLAYER_SETTINGS, ReducedMotionChoice } from '../models/player-settings';
import { MotionPreferenceService, REDUCED_MOTION_QUERY } from './motion-preference.service';
import { SettingsService } from './settings.service';

type Listener = (event: { matches: boolean }) => void;

/** The device's reduced-motion query, which the spec can change as the player's device would. */
function stubDevice(matches: boolean) {
  const listeners = new Set<Listener>();
  const query = {
    matches,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };
  const matchMedia = vi.fn((_query: string) => query);
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    listeners,
    change(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
}

describe('MotionPreferenceService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const motion = () => TestBed.inject(MotionPreferenceService);
  const choose = (reducedMotion: ReducedMotionChoice) =>
    TestBed.inject(SettingsService).preview({ reducedMotion });

  it('follows the device on auto, the default (SET-03 AC1)', () => {
    const device = stubDevice(true);

    expect(DEFAULT_PLAYER_SETTINGS.reducedMotion).toBe('auto');
    expect(motion().reduced()).toBe(true);
    expect(device.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });

  it('keeps motion when the device does not ask for less', () => {
    stubDevice(false);

    expect(motion().reduced()).toBe(false);
  });

  it.each<[boolean, ReducedMotionChoice, boolean]>([
    [true, 'auto', true],
    [true, 'on', true],
    [true, 'off', false],
    [false, 'auto', false],
    [false, 'on', true],
    [false, 'off', false],
  ])('with the device asking %s and the setting %s, reduces motion: %s', (asks, choice, reduced) => {
    stubDevice(asks);
    choose(choice);

    expect(motion().reduced()).toBe(reduced);
  });

  it('follows a change of the setting at once', () => {
    stubDevice(false);
    const service = motion();

    choose('on');
    expect(service.reduced()).toBe(true);
    choose('auto');
    expect(service.reduced()).toBe(false);
  });

  it('follows the device live when it changes its mind', () => {
    const device = stubDevice(false);
    const service = motion();

    device.change(true);
    expect(service.reduced()).toBe(true);
    device.change(false);
    expect(service.reduced()).toBe(false);

    // A device change does not override the player's own choice.
    choose('off');
    device.change(true);
    expect(service.reduced()).toBe(false);
  });

  it('stops listening to the device when the app goes', () => {
    const device = stubDevice(false);
    motion();
    expect(device.listeners.size).toBe(1);

    TestBed.resetTestingModule();

    expect(device.listeners.size).toBe(0);
  });

  it('keeps motion where there is no media query to ask, as in jsdom', () => {
    expect(typeof globalThis.matchMedia).not.toBe('function');

    expect(motion().reduced()).toBe(false);
    choose('on');
    expect(motion().reduced()).toBe(true);
  });
});
