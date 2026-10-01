import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Message } from '../models/message';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly baseUrl = '/api/messages';
  private readonly http = inject(HttpClient);

  /** The whole conversation, oldest first. */
  findAll(): Observable<Message[]> {
    return this.http.get<Message[]>(this.baseUrl);
  }

  /** Answers with the stored message followed by the AI's stored reply. */
  send(text: string): Observable<Message[]> {
    return this.http.post<Message[]>(this.baseUrl, { text });
  }
}
