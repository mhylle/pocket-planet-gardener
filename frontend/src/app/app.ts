import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message } from './core/models/message';
import { MessageService } from './core/services/message.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly messageService = inject(MessageService);

  protected readonly messages = signal<Message[]>([]);
  protected readonly text = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.messageService.findAll().subscribe({
      next: (messages) => this.messages.set(messages),
      error: () => this.error.set('Could not load the conversation.'),
    });
  }

  protected send(): void {
    const text = this.text().trim();
    if (!text || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.error.set(null);
    this.messageService.send(text).subscribe({
      next: (added) => {
        this.messages.update((current) => [...current, ...added]);
        this.text.set('');
        this.sending.set(false);
      },
      // The text stays in the input so it can be sent again.
      error: () => {
        this.error.set('The AI did not answer. Try again.');
        this.sending.set(false);
      },
    });
  }
}
