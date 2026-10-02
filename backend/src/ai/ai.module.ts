import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AiGatewayService } from './ai-gateway.service';
import { AiService } from './ai.service';

@Module({
  // AdminModule holds the AI switch, the budget and the usage log.
  imports: [AdminModule],
  providers: [AiService, AiGatewayService],
  // No routes of its own. Only the gateway is exported: features never call
  // AiService directly (D-4).
  exports: [AiGatewayService],
})
export class AiModule {}
