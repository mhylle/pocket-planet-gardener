import {
  applyChanges,
  DEFAULT_PLAYER_SETTINGS,
  withDefaults,
} from './settings-rules';

describe('withDefaults', () => {
  it('gives a new planet the defaults', () => {
    expect(withDefaults({})).toEqual({
      musicVolume: 0.6,
      musicMuted: false,
      sfxVolume: 0.8,
      sfxMuted: false,
      reducedMotion: 'auto',
    });
  });

  it('keeps the stored settings and fills in the rest', () => {
    expect(withDefaults({ musicVolume: 0.3, sfxMuted: true })).toEqual({
      ...DEFAULT_PLAYER_SETTINGS,
      musicVolume: 0.3,
      sfxMuted: true,
    });
  });

  it('keeps a stored 0 and false rather than the default', () => {
    expect(
      withDefaults({ musicVolume: 0, sfxVolume: 0, musicMuted: false }),
    ).toEqual({ ...DEFAULT_PLAYER_SETTINGS, musicVolume: 0, sfxVolume: 0 });
  });

  it('takes every stored setting', () => {
    const stored = {
      musicVolume: 1,
      musicMuted: true,
      sfxVolume: 0.1,
      sfxMuted: true,
      reducedMotion: 'on',
    } as const;

    expect(withDefaults(stored)).toEqual(stored);
  });
});

describe('applyChanges', () => {
  it('adds the changes to the stored settings', () => {
    expect(
      applyChanges({ musicVolume: 0.3 }, { sfxMuted: true, musicVolume: 0.5 }),
    ).toEqual({ musicVolume: 0.5, sfxMuted: true });
  });

  it('keeps only what was set, so the rest follow the defaults', () => {
    expect(applyChanges({}, { reducedMotion: 'off' })).toEqual({
      reducedMotion: 'off',
    });
  });

  it('leaves a setting alone when its change is undefined or null', () => {
    const changes = {
      musicVolume: undefined,
      sfxVolume: null,
      musicMuted: false,
    } as unknown as Parameters<typeof applyChanges>[1];

    expect(applyChanges({ musicVolume: 0.3, sfxVolume: 0.2 }, changes)).toEqual(
      { musicVolume: 0.3, sfxVolume: 0.2, musicMuted: false },
    );
  });
});
