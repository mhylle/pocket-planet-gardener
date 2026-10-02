import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatPageDto, ChatReplyDto } from '../models/chat';
import { ApiService } from './api.service';

/**
 * Chatting with a creature (CHT-01..04): which creature's chat is open, and its history,
 * sending and forgetting. Chat leaves the planet's version alone, so it goes straight to the
 * API rather than through the command lane. Methods reject with the HttpErrorResponse when
 * the request fails.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);
  private readonly openId = signal<string | null>(null);

  /** The creature whose chat is open; null when it is closed. */
  readonly creatureId = this.openId.asReadonly();

  open(creatureId: string): void {
    this.openId.set(creatureId);
  }

  close(): void {
    this.openId.set(null);
  }

  /** The latest page of the chat, or the page before the given ISO timestamp. */
  history(creatureId: string, before?: string): Promise<ChatPageDto> {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    return firstValueFrom(this.api.get<ChatPageDto>(this.path(creatureId) + query));
  }

  send(creatureId: string, text: string): Promise<ChatReplyDto> {
    return firstValueFrom(this.api.post<ChatReplyDto>(this.path(creatureId), { text }));
  }

  /** Deletes the chat and what the creature remembers of it (CHT-04 AC2). */
  async forget(creatureId: string): Promise<void> {
    await firstValueFrom(this.api.delete<void>(this.path(creatureId)));
  }

  private path(creatureId: string): string {
    return `/creatures/${encodeURIComponent(creatureId)}/chat`;
  }
}
