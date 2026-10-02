import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsage } from '../admin/ai-usage.entity';
import { AiModule } from '../ai/ai.module';
import { CreatureMemory } from '../creatures/creature-memory.entity';
import { Creature } from '../creatures/creature.entity';
import { PlanetEvent } from '../events/event.entity';
import { PlanetsModule } from '../planets/planets.module';
import { ChatMessage } from './chat-message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MemoryService } from './memory.service';

// Reads creatures, their memories, the event log and the AI usage log (the
// daily count) through its own repositories, so it needs none of their
// modules. PlanetsModule gives the snapshot the prompt describes, AiModule
// the gateway.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatMessage,
      Creature,
      CreatureMemory,
      PlanetEvent,
      AiUsage,
    ]),
    PlanetsModule,
    AiModule,
  ],
  providers: [ChatService, MemoryService],
  controllers: [ChatController],
})
export class ChatModule {}
