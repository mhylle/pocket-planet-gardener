import { Body, Controller, Get, Patch } from '@nestjs/common';
import { NoPlanet } from '../planets/planet-context/no-planet.decorator';
import { AdminSettingsService } from './admin-settings.service';
import type { AdminSettingsDto } from './dto/admin-settings.dto';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';

// Open to anyone in the PoC: there are no accounts to tell the game owner
// apart (D-0, ADM-01 AC3 not enforced).
@NoPlanet()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminSettings: AdminSettingsService) {}

  @Get('settings')
  get(): Promise<AdminSettingsDto> {
    return this.adminSettings.view();
  }

  /** Changes only the given settings; they apply from the next AI request. */
  @Patch('settings')
  update(@Body() body: UpdateAdminSettingsDto): Promise<AdminSettingsDto> {
    return this.adminSettings.update(body);
  }
}
