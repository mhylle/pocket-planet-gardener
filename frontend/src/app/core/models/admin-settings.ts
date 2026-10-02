/** The game owner's AI settings as served by GET/PATCH /api/admin/settings (ADM-01, ADM-02). */
export interface AdminSettings {
  /** The global AI switch; when off, every player gets the fallbacks (AIB-05). */
  aiEnabled: boolean;
  /** How many AI requests the whole game may make per day. */
  aiDailyBudget: number;
  aiRequestsToday: number;
}

/** What PATCH /api/admin/settings accepts; fields left out stay as they are. */
export type AdminSettingsChange = Partial<Pick<AdminSettings, 'aiEnabled' | 'aiDailyBudget'>>;
