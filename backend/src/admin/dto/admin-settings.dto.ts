/** Response of GET and PATCH /api/admin/settings. */
export interface AdminSettingsDto {
  aiEnabled: boolean;
  // Gateway calls a day that the model may answer; then fallbacks only.
  aiDailyBudget: number;
  // The calls the model answered today (UTC).
  aiRequestsToday: number;
}
