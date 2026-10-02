/** The client-relevant game tunables served by GET /api/config. */
export interface GameConfig {
  planetNameMin: number;
  planetNameMax: number;
  maxPlants: number;
  maxCreatures: number;
  chatMessageMaxChars: number;
  chatDailyLimit: number;
  syncIntervalSeconds: number;
  cloudRefillSeconds: number;
  sunOverrideMinutes: number;
  /** How long the sun takes to circle the planet once. */
  sunDayMinutes: number;
  summaryAfterMinutes: number;
  journalAfterHours: number;
}

/** The server's defaults, used until the config has loaded and whenever loading fails. */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  planetNameMin: 2,
  planetNameMax: 24,
  maxPlants: 60,
  maxCreatures: 8,
  chatMessageMaxChars: 200,
  chatDailyLimit: 30,
  syncIntervalSeconds: 10,
  cloudRefillSeconds: 60,
  sunOverrideMinutes: 5,
  sunDayMinutes: 60,
  summaryAfterMinutes: 60,
  journalAfterHours: 4,
};
