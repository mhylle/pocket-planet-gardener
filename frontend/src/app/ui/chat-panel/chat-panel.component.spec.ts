import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { MockInstance } from 'vitest';
import { ChatMessageDto, ChatPageDto, ChatReplyDto } from '../../core/models/chat';
import { ChatService } from '../../core/services/chat.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { creatureAt } from '../../testing/garden-fixtures';
import { ChatPanelComponent } from './chat-panel.component';

const URL = '/api/creatures/worm-1/chat';
const GREETING = 'Wiggle-hello, gardener! The soil is extra crumbly today.';
const worm = creatureAt('worm-1', 0, 0, { species: 'worm', name: 'Wigglenut' });

/** A chat line written the given number of minutes after ten o'clock. */
function line(
  minute: number,
  role: ChatMessageDto['role'],
  text: string,
  extra: Partial<ChatMessageDto> = {},
): ChatMessageDto {
  const createdAt = `2026-10-02T10:${String(minute).padStart(2, '0')}:00.000Z`;
  return { id: `m${minute}`, role, text, createdAt, ...extra };
}

describe('ChatPanelComponent', () => {
  let fixture: ComponentFixture<ChatPanelComponent>;
  let http: HttpTestingController;
  let chat: ChatService;
  let focusCanvas: MockInstance<SceneService['focusCanvas']>;
  let opener: HTMLButtonElement;
  let page: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ChatPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    chat = TestBed.inject(ChatService);
    focusCanvas = vi.spyOn(TestBed.inject(SceneService), 'focusCanvas');
    // Stands in for the creature card's Chat button, which has the focus when it opens.
    opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    chat.open(worm.id);
    fixture = TestBed.createComponent(ChatPanelComponent);
    fixture.componentRef.setInput('creature', worm);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    opener.remove();
    http.verify();
  });

  /** Lets pending promise callbacks run, then waits for the re-render. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function open(changes: Partial<ChatPageDto> = {}) {
    http
      .expectOne({ method: 'GET', url: URL })
      .flush({ messages: [], hasMore: false, remaining: 30, greeting: GREETING, ...changes });
    await settle();
  }

  async function type(value: string) {
    field().value = value;
    field().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function press(key: string, extra: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
    field().dispatchEvent(event);
    return event;
  }

  /** Types the text and sends it with Enter, returning the request it makes. */
  async function say(text: string) {
    await type(text);
    press('Enter');
    return http.expectOne({ method: 'POST', url: URL });
  }

  async function answer(reply: Partial<ChatReplyDto>, text = 'Hi') {
    (await say(text)).flush({ messages: [], remaining: 29, limitReached: false, ...reply });
    await settle();
  }

  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
  const field = () => page.querySelector<HTMLTextAreaElement>('textarea')!;
  const lines = () => [...page.querySelectorAll('.message')].map(text);
  const waiting = () => page.querySelector('.waiting')!;
  const hints = () => [...page.querySelectorAll('.hint')].map(text);
  const button = (label: string) =>
    [...page.querySelectorAll('button')].find((each) => text(each) === label);
  const send = () => button('Send') as HTMLButtonElement;

  describe('opening (CHT-01 AC1, CHT-04 AC1)', () => {
    it('loads the history and shows it, then the greeting, with the focus in the labelled box', async () => {
      await open({
        messages: [
          line(1, 'user', 'Do you like rain?'),
          line(2, 'creature', 'Oh, I adore a good puddle!', { source: 'ai' }),
        ],
      });

      const dialog = page.querySelector('[role="dialog"]')!;
      expect(dialog.getAttribute('aria-labelledby')).toBe('chat-title');
      expect(text(page.querySelector('#chat-title')!)).toBe('Chat with Wigglenut');
      expect(lines()).toEqual([
        'You: Do you like rain?',
        'Wigglenut: Oh, I adore a good puddle!',
        `Wigglenut: ${GREETING}`,
      ]);
      expect(text(page.querySelector('label[for="chat-text"]')!)).toBe(
        'Say something to Wigglenut',
      );
      expect(field().id).toBe('chat-text');
      expect(document.activeElement).toBe(field());
    });

    it('shows only the greeting for a first chat', async () => {
      await open();

      expect(lines()).toEqual([`Wigglenut: ${GREETING}`]);
      expect(button('Earlier messages')).toBeUndefined();
    });

    it("says so when the chat can't be loaded", async () => {
      http
        .expectOne(URL)
        .flush(
          { statusCode: 404, message: "That creature isn't on your planet." },
          { status: 404, statusText: 'Not Found' },
        );
      await settle();

      expect(text(page.querySelector('.error')!)).toBe("That creature isn't on your planet.");
    });
  });

  describe('sending (CHT-01 AC2, AC3)', () => {
    it('shows the waiting line until the answer arrives', async () => {
      await open();

      const request = await say('Hi Wigglenut!');
      expect(request.request.body).toEqual({ text: 'Hi Wigglenut!' });
      await fixture.whenStable();

      expect(text(waiting())).toBe('Wigglenut is clearing their throat…');
      expect(waiting().getAttribute('aria-live')).toBe('polite');
      expect(lines().at(-1)).toBe('You: Hi Wigglenut!');
      expect(field().value).toBe('');
      expect(field().readOnly).toBe(true);
      expect(send().disabled).toBe(true);

      request.flush({
        messages: [
          line(5, 'user', 'Hi Wigglenut!'),
          line(6, 'creature', 'Hello, hello! Mind the pebbles.', { source: 'ai' }),
        ],
        remaining: 29,
        limitReached: false,
      });
      await settle();

      expect(text(waiting())).toBe('');
      expect(lines()).toEqual([
        `Wigglenut: ${GREETING}`,
        'You: Hi Wigglenut!',
        'Wigglenut: Hello, hello! Mind the pebbles.',
      ]);
      expect(field().readOnly).toBe(false);
      expect(document.activeElement).toBe(field());
    });

    it('puts the new lines in a polite log, apart from the older pages', async () => {
      await open({ messages: [line(1, 'user', 'Hello?')] });

      const [older, recent] = [...page.querySelectorAll('ol')];
      expect(older.closest('[role="log"]')).toBeNull();
      expect(recent.parentElement!.getAttribute('role')).toBe('log');
      expect(text(recent)).toContain(GREETING);
    });

    it('starts a new line with Shift and Enter instead of sending', async () => {
      await open();
      await type('Line one');

      const event = press('Enter', { shiftKey: true });

      expect(event.defaultPrevented).toBe(false);
      http.expectNone({ method: 'POST', url: URL });
    });

    it('sends with the Send button, and not an empty message', async () => {
      await open();
      await type('   ');
      expect(send().disabled).toBe(true);

      await type('Hello there');
      send().click();

      expect(http.expectOne({ method: 'POST', url: URL }).request.body).toEqual({
        text: 'Hello there',
      });
    });

    it('counts an emoji as one character, and stops at the limit', async () => {
      await open();

      await type('Hi 🌻');
      expect(text(page.querySelector('#chat-count')!)).toBe('4 / 200');

      await type('a'.repeat(199) + '🌻🌼');
      expect(field().value).toBe('a'.repeat(199) + '🌻');
      expect(text(page.querySelector('#chat-count')!)).toBe('200 / 200');
    });

    it('keeps the message and says so when it does not go through', async () => {
      await open();

      (await say('Are you there?')).flush(null, { status: 503, statusText: 'Unavailable' });
      await settle();

      expect(field().value).toBe('Are you there?');
      expect(text(page.querySelector('.error')!)).toBe(
        'Something went a little wobbly. Please try again in a moment.',
      );
      expect(lines()).toEqual([`Wigglenut: ${GREETING}`]);
    });
  });

  it('offers "Try again" after a napping answer, sending the same text (CHT-01 AC4)', async () => {
    await open();
    const nap = 'Wigglenut has dozed off mid-thought. Try again in a bit.';
    await answer(
      {
        messages: [
          line(5, 'user', 'Tell me a story'),
          line(6, 'creature', nap, { source: 'fallback' }),
        ],
      },
      'Tell me a story',
    );
    expect(lines().at(-1)).toBe(`Wigglenut: ${nap}`);
    await type('Something new');

    button('Try again')!.click();
    const again = http.expectOne({ method: 'POST', url: URL });
    expect(again.request.body).toEqual({ text: 'Tell me a story' });
    await fixture.whenStable();
    expect(field().value).toBe('Something new');
    again.flush({
      messages: [
        line(7, 'user', 'Tell me a story'),
        line(8, 'creature', 'Once, a pebble yawned…', { source: 'ai' }),
      ],
      remaining: 28,
      limitReached: false,
    });
    await settle();

    expect(lines().at(-1)).toBe('Wigglenut: Once, a pebble yawned…');
    expect(button('Try again')).toBeUndefined();
  });

  describe('the daily limit (CHT-03)', () => {
    it('says how many messages are left once 5 or fewer are (AC2)', async () => {
      await open({ remaining: 3 });

      expect(hints()).toContain('3 messages left today');
    });

    it('says nothing about the limit while plenty are left', async () => {
      await open({ remaining: 12 });

      expect(hints().join(' ')).not.toContain('left today');
    });

    it("counts down with each answer's remaining", async () => {
      await open({ remaining: 6 });
      expect(hints().join(' ')).not.toContain('left today');

      await answer({ remaining: 1 });

      expect(hints()).toContain('1 message left today');
    });

    it('shows the sleepy line and closes the box until tomorrow (AC1)', async () => {
      await open({ remaining: 1 });
      const sleepy = 'Mmm… Wigglenut is getting very sleepy. Come back tomorrow for more chatter?';

      await answer({
        messages: [line(5, 'creature', sleepy, { source: 'scripted' })],
        remaining: 0,
        limitReached: true,
      });

      expect(lines().at(-1)).toBe(`Wigglenut: ${sleepy}`);
      expect(field().disabled).toBe(true);
      expect(send().disabled).toBe(true);
      expect(hints()).toContain("That's all the chatting for today. See you tomorrow!");
      expect(hints().join(' ')).not.toContain('left today');
      expect(button('Try again')).toBeUndefined();
    });

    it('opens with the box closed when the day is used up already', async () => {
      await open({ remaining: 0 });

      expect(field().disabled).toBe(true);
      expect(hints()).toContain("That's all the chatting for today. See you tomorrow!");
    });
  });

  it('shows a notice from the game with its link opening in a new tab (AIB-03 AC2)', async () => {
    await open();
    const help =
      "If you're having a hard time, you don't have to deal with it alone. Talking to someone " +
      'you trust, or a support line, can really help.';

    await answer({
      messages: [
        line(5, 'user', 'I feel awful'),
        line(6, 'notice', help, {
          source: 'scripted',
          link: { label: 'Find a helpline', url: 'https://findahelpline.com' },
        }),
        line(7, 'creature', "I'm right here with you.", { source: 'ai' }),
      ],
    });

    const notice = page.querySelector('.message.notice')!;
    expect(text(notice.querySelector('.speaker')!)).toBe('From the game');
    expect(text(notice)).toContain(help);
    const link = notice.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://findahelpline.com');
    expect(link.target).toBe('_blank');
    expect(link.rel.split(' ')).toContain('noopener');
    expect(text(link)).toBe('Find a helpline (opens in a new tab)');
    // Before the creature's answer, and styled apart from both speakers.
    const order = [...page.querySelectorAll('.message')].slice(-3);
    expect(order.map((each) => each.className)).toEqual([
      'message user',
      'message notice',
      'message creature',
    ]);
    expect(lines().at(-1)).toBe("Wigglenut: I'm right here with you.");
  });

  it('puts the page before the oldest message above it with "Earlier messages" (CHT-04 AC1)', async () => {
    await open({
      messages: [line(3, 'user', 'Third'), line(4, 'creature', 'Fourth')],
      hasMore: true,
    });

    button('Earlier messages')!.click();
    http
      .expectOne({
        method: 'GET',
        url: `${URL}?before=${encodeURIComponent('2026-10-02T10:03:00.000Z')}`,
      })
      .flush({
        messages: [line(1, 'user', 'First'), line(2, 'creature', 'Second')],
        hasMore: false,
        remaining: 30,
        greeting: 'Another hello',
      });
    await settle();

    expect(lines()).toEqual([
      'You: First',
      'Wigglenut: Second',
      'You: Third',
      'Wigglenut: Fourth',
      `Wigglenut: ${GREETING}`,
    ]);
    expect(button('Earlier messages')).toBeUndefined();
  });

  describe('"Forget our chats" (CHT-04 AC2)', () => {
    it('asks first, then deletes the chat and shows the greeting again', async () => {
      await open({ messages: [line(1, 'user', 'I love sunflowers')] });
      await answer({
        messages: [line(5, 'user', 'Hi'), line(6, 'creature', 'Hi back!', { source: 'ai' })],
      });

      button('Forget our chats')!.click();
      await fixture.whenStable();

      const prompt = page.querySelector('.forget p')!;
      expect(text(prompt)).toContain('Forget everything you and Wigglenut have chatted about?');
      expect(document.activeElement).toBe(prompt);
      http.expectNone({ method: 'DELETE', url: URL });

      button('Yes, forget')!.click();
      http
        .expectOne({ method: 'DELETE', url: URL })
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(lines()).toEqual([`Wigglenut: ${GREETING}`]);
      expect(button('Forget our chats')).toBeDefined();
      expect(document.activeElement).toBe(field());
    });

    it('keeps the chat on "Keep our chats"', async () => {
      await open({ messages: [line(1, 'user', 'I love sunflowers')] });

      button('Forget our chats')!.click();
      await fixture.whenStable();
      button('Keep our chats')!.click();
      await fixture.whenStable();

      expect(lines()).toEqual(['You: I love sunflowers', `Wigglenut: ${GREETING}`]);
      expect(document.activeElement).toBe(button('Forget our chats'));
    });
  });

  describe('closing (SET-05)', () => {
    it('closes on Escape, gives the focus back to the Chat button and leaves the card open', async () => {
      await open();
      const reachedDocument = vi.fn();
      document.addEventListener('keydown', reachedDocument);

      press('Escape');
      document.removeEventListener('keydown', reachedDocument);

      expect(chat.creatureId()).toBeNull();
      expect(document.activeElement).toBe(opener);
      expect(reachedDocument).not.toHaveBeenCalled();
    });

    it('gives the focus to the planet when the card has gone', async () => {
      await open();
      opener.remove();

      button('Close')!.click();

      expect(chat.creatureId()).toBeNull();
      expect(focusCanvas).toHaveBeenCalled();
    });

    it('closes the forget question first on Escape', async () => {
      await open();
      button('Forget our chats')!.click();
      await fixture.whenStable();

      press('Escape');
      await fixture.whenStable();

      expect(chat.creatureId()).toBe(worm.id);
      expect(button('Yes, forget')).toBeUndefined();
    });
  });
});
