/** Reduced motion: follow the device's setting, always reduce, or never. */
export const REDUCED_MOTION_CHOICES = ['auto', 'on', 'off'] as const;

export type ReducedMotion = (typeof REDUCED_MOTION_CHOICES)[number];

/** The player's audio and motion settings (SET-01, SET-03). Volumes run from 0 to 1. */
export interface PlayerSettings {
  musicVolume: number;
  musicMuted: boolean;
  sfxVolume: number;
  sfxMuted: boolean;
  reducedMotion: ReducedMotion;
}

/** What applies to each setting the player has not changed. */
export const DEFAULT_PLAYER_SETTINGS: Readonly<PlayerSettings> = {
  musicVolume: 0.6,
  musicMuted: false,
  sfxVolume: 0.8,
  sfxMuted: false,
  reducedMotion: 'auto',
};

/** Every setting: the stored one, or the default where there is none. */
export function withDefaults(stored: Partial<PlayerSettings>): PlayerSettings {
  const defaults = DEFAULT_PLAYER_SETTINGS;
  return {
    musicVolume: stored.musicVolume ?? defaults.musicVolume,
    musicMuted: stored.musicMuted ?? defaults.musicMuted,
    sfxVolume: stored.sfxVolume ?? defaults.sfxVolume,
    sfxMuted: stored.sfxMuted ?? defaults.sfxMuted,
    reducedMotion: stored.reducedMotion ?? defaults.reducedMotion,
  };
}

/**
 * The stored settings with the given changes made; an undefined or null
 * change leaves its setting alone. Only settings the player has changed are
 * kept, so the others follow the defaults.
 */
export function applyChanges(
  stored: Partial<PlayerSettings>,
  changes: Partial<PlayerSettings>,
): Partial<PlayerSettings> {
  const given = Object.entries(changes).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  return { ...stored, ...Object.fromEntries(given) };
}
