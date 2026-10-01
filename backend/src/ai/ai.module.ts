import { Module } from '@nestjs/common';
import { AiService } from './ai.service';

@Module({
  providers: [AiService],
  // No routes of its own: the feature modules that use the AI call it.
  exports: [AiService],
})
export class AiModule {}
