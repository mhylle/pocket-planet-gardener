import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { errorMessage } from '../../core/helpers/error-message';
import { ChatMessageDto } from '../../core/models/chat';
import { CreatureDto } from '../../core/models/creature';
import { ChatService } from '../../core/services/chat.service';
import { GameConfigService } from '../../core/services/game-config.service';
import { SceneService } from '../../scene/scene.service';

/** From this many messages left today down, the panel says how many (CHT-03 AC2). */
const FEW_LEFT = 5;

/**
 * A chat with one creature (CHT-01), beside the planet so the rest of the game stays usable
 * while it is open (AIB-04 AC1). Earlier messages come first, a page at a time behind
 * "Earlier messages" (CHT-04 AC1), then the creature's greeting in its own style (CHT-01 AC1),
 * then this visit's messages. While an answer is on its way an in-character line says the
 * creature is thinking (AC3); a napping answer offers "Try again" with the same text (AC4).
 * Close to today's limit it says how many messages are left, and at the limit the box to
 * write in closes until tomorrow (CHT-03). A notice from the game shows out of character with
 * its link to real help (AIB-03 AC2). "Forget our chats" asks first, then deletes the chat
 * (CHT-04 AC2). The box to write in takes the focus when the panel opens; Escape or Close
 * closes it and gives the focus back to the Chat button, or to the planet once the card has
 * gone (SET-05).
 */
@Component({
  selector: 'app-chat-panel',
  imports: [NgTemplateOutlet],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
  host: { '(keydown.escape)': 'escape($event)' },
})
export class ChatPanelComponent implements OnInit {
  readonly creature = input.required<CreatureDto>();

  private readonly chat = inject(ChatService);
  private readonly scene = inject(SceneService);
  private readonly injector = inject(Injector);
  private readonly config = inject(GameConfigService).config;
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly log = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');
  private readonly prompt = viewChild<ElementRef<HTMLElement>>('prompt');
  private readonly forgetButton = viewChild<ElementRef<HTMLElement>>('forgetButton');
  /** The Chat button that opened the panel. */
  private readonly opener = document.activeElement;

  /** The pages of older messages loaded so far, oldest first. */
  protected readonly earlier = signal<ChatMessageDto[]>([]);
  /** The messages of this visit, after the greeting. */
  protected readonly recent = signal<ChatMessageDto[]>([]);
  protected readonly greeting = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly remaining = signal<number | null>(null);
  protected readonly limitReached = signal(false);
  protected readonly draft = signal('');
  /** The message on its way, shown until the answer comes. */
  protected readonly pending = signal<string | null>(null);
  /** The last message sent, which "Try again" sends once more. */
  private readonly lastSent = signal<string | null>(null);
  private loadingEarlier = false;
  protected readonly confirming = signal(false);
  protected readonly forgetting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly max = computed(() => this.config().chatMessageMaxChars);
  /** Counted in characters as a player sees them, so an emoji counts as one. */
  protected readonly count = computed(() => [...this.draft()].length);
  protected readonly waitingLine = computed(
    () => `${this.creature().name} is clearing their throat…`,
  );
  protected readonly canSend = computed(
    () => this.draft().trim() !== '' && this.pending() === null && !this.limitReached(),
  );
  /** The text to send again after a napping answer; null otherwise. */
  protected readonly retry = computed(() =>
    this.recent().at(-1)?.source === 'fallback' && this.pending() === null && !this.limitReached()
      ? this.lastSent()
      : null,
  );
  /** "3 messages left today", only when few are left and the limit is not reached yet. */
  protected readonly left = computed(() => {
    const remaining = this.remaining();
    if (remaining === null || remaining > FEW_LEFT || this.limitReached()) {
      return null;
    }
    if (remaining === 0) {
      return 'No messages left today';
    }
    return `${remaining} ${remaining === 1 ? 'message' : 'messages'} left today`;
  });

  constructor() {
    afterNextRender(() => this.field().nativeElement.focus());
  }

  ngOnInit(): void {
    void this.load();
  }

  protected typed(field: HTMLTextAreaElement): void {
    const characters = [...field.value];
    if (characters.length > this.max()) {
      field.value = characters.slice(0, this.max()).join('');
    }
    this.draft.set(field.value);
  }

  /** Enter sends; Shift and Enter start a new line. */
  protected keydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    void this.send();
  }

  /** Sends the text written in the box, or the given text again ("Try again"), keeping the box. */
  protected async send(again?: string): Promise<void> {
    const text = again ?? this.draft().trim();
    if (!text || this.pending() !== null || this.limitReached()) {
      return;
    }
    this.pending.set(text);
    this.lastSent.set(text);
    if (again === undefined) {
      this.draft.set('');
    }
    this.error.set(null);
    this.scrollToEnd();
    try {
      const reply = await this.chat.send(this.creature().id, text);
      this.recent.update((messages) => [...messages, ...reply.messages]);
      this.remaining.set(reply.remaining);
      this.limitReached.set(reply.limitReached);
    } catch (error) {
      if (again === undefined) {
        this.draft.set(text);
      }
      this.error.set(errorMessage(error));
    } finally {
      this.pending.set(null);
    }
    this.scrollToEnd();
    this.refocus();
  }

  /** Puts the page before the oldest message above it, keeping in view what was in view. */
  protected async loadEarlier(): Promise<void> {
    const oldest = this.earlier()[0];
    if (!oldest || this.loadingEarlier) {
      return;
    }
    this.loadingEarlier = true;
    try {
      const page = await this.chat.history(this.creature().id, oldest.createdAt);
      const log = this.log().nativeElement;
      const fromEnd = log.scrollHeight - log.scrollTop;
      this.earlier.update((messages) => [...page.messages, ...messages]);
      this.hasMore.set(page.hasMore);
      this.remaining.set(page.remaining);
      this.afterRender(() => {
        log.scrollTop = log.scrollHeight - fromEnd;
        // The button goes with the last page, so the focus stays with the messages.
        if (document.activeElement === document.body) {
          log.focus();
        }
      });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loadingEarlier = false;
    }
  }

  /** Opens or closes the "Forget our chats" question, moving the focus with it. */
  protected ask(confirming: boolean): void {
    this.error.set(null);
    this.confirming.set(confirming);
    this.afterRender(() =>
      (confirming ? this.prompt() : this.forgetButton())?.nativeElement.focus(),
    );
  }

  protected async forget(): Promise<void> {
    this.forgetting.set(true);
    this.error.set(null);
    try {
      await this.chat.forget(this.creature().id);
      this.earlier.set([]);
      this.recent.set([]);
      this.hasMore.set(false);
      this.lastSent.set(null);
      this.confirming.set(false);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.forgetting.set(false);
    }
    this.refocus();
  }

  protected close(): void {
    this.chat.close();
    const back = this.opener;
    if (back instanceof HTMLElement && back.isConnected && back !== document.body) {
      back.focus();
    } else {
      this.scene.focusCanvas();
    }
  }

  protected escape(event: Event): void {
    // Only the chat closes; the creature card under it waits for the next Escape.
    event.stopPropagation();
    if (this.confirming()) {
      this.ask(false);
    } else {
      this.close();
    }
  }

  private async load(): Promise<void> {
    try {
      const page = await this.chat.history(this.creature().id);
      this.earlier.set(page.messages);
      this.hasMore.set(page.hasMore);
      this.remaining.set(page.remaining);
      this.greeting.set(page.greeting);
      // Today's chats were used up on an earlier visit: the box stays closed (CHT-03 AC1).
      this.limitReached.set(page.remaining === 0);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
    this.scrollToEnd();
    this.refocus();
  }

  private scrollToEnd(): void {
    this.afterRender(() => {
      const log = this.log().nativeElement;
      log.scrollTop = log.scrollHeight;
    });
  }

  /**
   * Puts the focus back in the box to write in, or on the panel once the box has closed for
   * the day, when a button that had it went away or was disabled.
   */
  private refocus(): void {
    this.afterRender(() => {
      const focused = document.activeElement;
      if (focused && focused !== document.body) {
        return;
      }
      const field = this.field().nativeElement;
      (field.disabled ? this.panel().nativeElement : field).focus();
    });
  }

  private afterRender(step: () => void): void {
    afterNextRender(step, { injector: this.injector });
  }
}
