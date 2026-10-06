import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { REDUCED_MOTION_CHOICES, type ReducedMotion } from '../settings-rules';

/** Body of PATCH /api/planet/settings: only the settings to change. */
export class UpdatePlayerSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  musicVolume?: number;

  @IsOptional()
  @IsBoolean()
  musicMuted?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  sfxVolume?: number;

  @IsOptional()
  @IsBoolean()
  sfxMuted?: boolean;

  @IsOptional()
  @IsIn(REDUCED_MOTION_CHOICES)
  reducedMotion?: ReducedMotion;
}
