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
  cloudDriftDegreesPerMinute: number;
  rainSeconds: number;
  rainRadiusSteps: number;
  sunOverrideMinutes: number;
  sunDayMinutes: number;
  summaryAfterMinutes: number;
  journalAfterHours: number;
}
