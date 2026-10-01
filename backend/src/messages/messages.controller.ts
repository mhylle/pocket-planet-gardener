import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from './message.entity';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /** Returns the stored message followed by the AI's stored reply. */
  @Post()
  send(@Body() dto: CreateMessageDto): Promise<Message[]> {
    return this.messagesService.send(dto.text);
  }

  @Get()
  findAll(): Promise<Message[]> {
    return this.messagesService.findAll();
  }
}
