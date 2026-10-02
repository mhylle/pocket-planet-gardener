import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatPageDto, ChatReplyDto } from '../models/chat';
import { ChatService } from './chat.service';
import { PlanetIdentityService } from './planet-identity.service';

const page: ChatPageDto = { messages: [], hasMore: false, remaining: 30, greeting: 'Hello!' };

describe('ChatService', () => {
  let http: HttpTestingController;
  let chat: ChatService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    chat = TestBed.inject(ChatService);
    TestBed.inject(PlanetIdentityService).set('planet-1');
  });

  afterEach(() => http.verify());

  it('remembers whose chat is open', () => {
    expect(chat.creatureId()).toBeNull();

    chat.open('worm-1');
    expect(chat.creatureId()).toBe('worm-1');

    chat.close();
    expect(chat.creatureId()).toBeNull();
  });

  it("loads the latest page of a creature's chat for this planet", async () => {
    const loading = chat.history('worm-1');
    const request = http.expectOne({ method: 'GET', url: '/api/creatures/worm-1/chat' });
    expect(request.request.headers.get('X-Planet-Id')).toBe('planet-1');
    request.flush(page);

    expect(await loading).toEqual(page);
  });

  it('loads the page before a timestamp', async () => {
    const loading = chat.history('worm-1', '2026-10-02T10:00:00.000Z');
    http
      .expectOne({
        method: 'GET',
        url: '/api/creatures/worm-1/chat?before=2026-10-02T10%3A00%3A00.000Z',
      })
      .flush(page);

    await loading;
  });

  it('sends the text and returns the reply', async () => {
    const reply: ChatReplyDto = { messages: [], remaining: 29, limitReached: false };

    const sending = chat.send('worm-1', 'Hi there');
    const request = http.expectOne({ method: 'POST', url: '/api/creatures/worm-1/chat' });
    expect(request.request.body).toEqual({ text: 'Hi there' });
    request.flush(reply);

    expect(await sending).toEqual(reply);
  });

  it('forgets the chat', async () => {
    const forgetting = chat.forget('worm-1');
    http
      .expectOne({ method: 'DELETE', url: '/api/creatures/worm-1/chat' })
      .flush(null, { status: 204, statusText: 'No Content' });

    await forgetting;
  });

  it('rejects when the creature is not on the planet', async () => {
    const loading = chat.history('elsewhere');
    http
      .expectOne('/api/creatures/elsewhere/chat')
      .flush(
        { statusCode: 404, message: "That creature isn't on your planet." },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(loading).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
