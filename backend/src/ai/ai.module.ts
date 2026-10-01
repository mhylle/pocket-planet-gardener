import { Module } from '@nestjs/common';
import { AiService } from './ai.service';

@Module({
  providers: [AiService],
  // No routes of its own: the messages module calls it to answer a chat.
  exports: [AiService],
})
export class AiModule {}
