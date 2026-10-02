import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/** Body of PATCH /api/admin/settings: only the settings to change. */
export class UpdateAdminSettingsDto {
  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  // 0 sends every AI feature to its fallback.
  @IsOptional()
  @IsInt()
  @Min(0)
  aiDailyBudget?: number;
}
