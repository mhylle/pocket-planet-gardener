import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSetting } from './admin-setting.entity';
import { AdminController } from './admin.controller';
import { AdminSettingsService } from './admin-settings.service';
import { AiUsage } from './ai-usage.entity';
import { AiUsageService } from './ai-usage.service';

// AiModule imports this one for the AI switch, the budget and the usage log;
// this one never imports AiModule.
@Module({
  imports: [TypeOrmModule.forFeature([AdminSetting, AiUsage])],
  providers: [AdminSettingsService, AiUsageService],
  controllers: [AdminController],
  exports: [AdminSettingsService, AiUsageService],
})
export class AdminModule {}
