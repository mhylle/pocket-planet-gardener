/** Reduced motion: follow the device ('auto'), always ('on') or never ('off') (SET-03). */
export type ReducedMotionChoice = 'auto' | 'on' | 'off';

/** The player's sound and motion settings, as served by GET/PATCH /api/planet/settings. */
export interface PlayerSettings {
  /** 0 to 1. */
  musicVolume: number;
  musicMuted: boolean;
  /** 0 to 1. */
  sfxVolume: number;
  sfxMuted: boolean;
  reducedMotion: ReducedMotionChoice;
}

/** A new planet's settings, which the game also uses until a planet's settings have loaded. */
export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  musicVolume: 0.6,
  musicMuted: false,
  sfxVolume: 0.8,
  sfxMuted: false,
  reducedMotion: 'auto',
};
