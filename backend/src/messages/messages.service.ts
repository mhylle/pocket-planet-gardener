import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { Message } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly ai: AiService,
  ) {}

  /** The whole conversation, oldest first. */
  findAll(): Promise<Message[]> {
    return this.messagesRepository.find({ order: { id: 'ASC' } });
  }

  /**
   * Asks the AI, with the conversation so far as context, then stores the
   * text and the reply together. Nothing is stored when the AI fails, so the
   * history never holds a question without its answer.
   */
  async send(text: string): Promise<Message[]> {
    const history = await this.findAll();
    const reply = await this.ai.complete([
      ...history.map((m) => ({ role: m.role, content: m.text })),
      { role: 'user', content: text },
    ]);

    return this.messagesRepository.save([
      this.messagesRepository.create({ role: 'user', text }),
      this.messagesRepository.create({ role: 'assistant', text: reply }),
    ]);
  }
}
