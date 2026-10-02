import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPlanet } from '../planets/planet-context/current-planet.decorator';
import { ChatService } from './chat.service';
import { ChatHistoryQueryDto } from './dto/chat-history-query.dto';
import type { ChatHistoryDto, ChatSendResultDto } from './dto/chat-message.dto';
import { SendChatDto } from './dto/send-chat.dto';

/** A creature's chat with the player (CHT-01..04). */
@Controller('creatures/:id/chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  history(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ChatHistoryQueryDto,
  ): Promise<ChatHistoryDto> {
    return this.chat.history(planetId, id, query.before, query.limit);
  }

  @Post()
  send(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendChatDto,
  ): Promise<ChatSendResultDto> {
    return this.chat.send(planetId, id, body.text);
  }

  // "Forget our chats" (CHT-04 AC2).
  @Delete()
  @HttpCode(204)
  forget(
    @CurrentPlanet() planetId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.chat.forget(planetId, id);
  }
}
