/** The tunables the client needs, served by GET /api/config. */
export interface PublicGameConfigDto {
  planetNameMin: number;
  planetNameMax: number;
  maxPlants: number;
  maxCreatures: number;
  chatMessageMaxChars: number;
  chatDailyLimit: number;
  syncIntervalSeconds: number;
  cloudRefillSeconds: number;
  sunOverrideMinutes: number;
  summaryAfterMinutes: number;
  journalAfterHours: number;
}
