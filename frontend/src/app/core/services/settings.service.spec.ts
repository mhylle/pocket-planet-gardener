import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_PLAYER_SETTINGS, PlayerSettings } from '../models/player-settings';
import { SETTINGS_NOT_SAVED, SettingsService } from './settings.service';

const QUIET: PlayerSettings = {
  musicVolume: 0.2,
  musicMuted: true,
  sfxVolume: 0.5,
  sfxMuted: false,
  reducedMotion: 'on',
};

describe('SettingsService', () => {
  let http: HttpTestingController;
  let settings: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    settings = TestBed.inject(SettingsService);
  });

  afterEach(() => http.verify());

  const failure = { status: 500, statusText: 'Internal Server Error' };

  function loadQuiet() {
    settings.load();
    http.expectOne({ method: 'GET', url: '/api/planet/settings' }).flush(QUIET);
  }

  it('uses the defaults until the planet settings load', () => {
    expect(settings.settings()).toEqual(DEFAULT_PLAYER_SETTINGS);

    loadQuiet();

    expect(settings.settings()).toEqual(QUIET);
  });

  it('keeps the defaults when the settings cannot be loaded', () => {
    settings.load();
    http.expectOne('/api/planet/settings').flush(null, failure);

    expect(settings.settings()).toEqual(DEFAULT_PLAYER_SETTINGS);
    expect(settings.notice()).toBeNull();
  });

  it('applies a change at once and saves only the change (SET-01 AC2)', () => {
    loadQuiet();

    settings.update({ musicVolume: 0.3 });

    expect(settings.settings().musicVolume).toBe(0.3);
    const req = http.expectOne({ method: 'PATCH', url: '/api/planet/settings' });
    expect(req.request.body).toEqual({ musicVolume: 0.3 });
    req.flush({ ...QUIET, musicVolume: 0.3 });
    expect(settings.settings()).toEqual({ ...QUIET, musicVolume: 0.3 });
    expect(settings.notice()).toBeNull();
  });

  it('previews a change without saving it', () => {
    settings.preview({ sfxVolume: 0.1 });

    expect(settings.settings().sfxVolume).toBe(0.1);
    http.expectNone('/api/planet/settings');
  });

  it('goes back to the saved settings with a calm notice when a save fails', () => {
    loadQuiet();

    settings.update({ reducedMotion: 'off' });
    expect(settings.settings().reducedMotion).toBe('off');
    http.expectOne('/api/planet/settings').flush(null, failure);

    expect(settings.settings()).toEqual(QUIET);
    expect(settings.notice()).toBe(SETTINGS_NOT_SAVED);

    // The next change clears the notice.
    settings.update({ sfxMuted: true });
    expect(settings.notice()).toBeNull();
    http.expectOne('/api/planet/settings').flush({ ...QUIET, sfxMuted: true });
  });

  it('keeps the latest change when an earlier save answers late', () => {
    loadQuiet();

    settings.update({ musicVolume: 0.4 });
    settings.update({ musicVolume: 0.5 });
    const [first, second] = http.match('/api/planet/settings');
    second.flush({ ...QUIET, musicVolume: 0.5 });
    first.flush({ ...QUIET, musicVolume: 0.4 });

    expect(settings.settings().musicVolume).toBe(0.5);
  });

  it('forgets the planet settings on reset, dropping answers still on their way', () => {
    loadQuiet();
    settings.update({ sfxVolume: 0.9 });
    const saving = http.expectOne('/api/planet/settings');

    settings.reset();

    expect(saving.cancelled).toBe(true);
    expect(settings.settings()).toEqual(DEFAULT_PLAYER_SETTINGS);
  });
});
