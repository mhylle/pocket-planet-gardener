import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { Message } from './core/models/message';

const stored: Message[] = [
  { id: 1, role: 'user', text: 'What is 2+2?', createdAt: '2026-10-01T10:00:00Z' },
  { id: 2, role: 'assistant', text: '2+2 is 4.', createdAt: '2026-10-01T10:00:00Z' },
];

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Renders the page and answers its initial load with the given conversation. */
  async function render(conversation: Message[]) {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: '/api/messages' }).flush(conversation);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    return { fixture, page };
  }

  function lines(page: HTMLElement): string[] {
    return [...page.querySelectorAll('.message')].map(
      (p) => `${p.querySelector('.author')?.textContent}: ${p.querySelector('.text')?.textContent}`,
    );
  }

  async function type(fixture: { whenStable(): Promise<unknown> }, page: HTMLElement, text: string) {
    const input = page.querySelector('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('shows the stored conversation, both sides, in order', async () => {
    const { page } = await render(stored);

    expect(lines(page)).toEqual(['You: What is 2+2?', 'AI: 2+2 is 4.']);
  });

  it('says so when there are no messages yet', async () => {
    const { page } = await render([]);

    expect(page.querySelector('.empty')?.textContent).toContain('No messages yet');
  });

  it('sends the message and appends it with the reply', async () => {
    const { fixture, page } = await render(stored);

    await type(fixture, page, '  And times 3?  ');
    const req = http.expectOne({ method: 'POST', url: '/api/messages' });
    expect(req.request.body).toEqual({ text: 'And times 3?' });
    expect(page.querySelector('.pending')?.textContent).toContain('thinking');

    req.flush([
      { id: 3, role: 'user', text: 'And times 3?', createdAt: '' },
      { id: 4, role: 'assistant', text: '4 times 3 is 12.', createdAt: '' },
    ]);
    await fixture.whenStable();

    expect(lines(page)).toEqual([
      'You: What is 2+2?',
      'AI: 2+2 is 4.',
      'You: And times 3?',
      'AI: 4 times 3 is 12.',
    ]);
    expect(page.querySelector('input')!.value).toBe('');
    expect(page.querySelector('.pending')).toBeNull();
  });

  it('does not send a blank message', async () => {
    const { fixture, page } = await render([]);

    await type(fixture, page, '   ');

    http.expectNone({ method: 'POST', url: '/api/messages' });
    expect(page.querySelector('button')!.disabled).toBe(true);
  });

  it('shows an error and keeps the text when the AI fails', async () => {
    const { fixture, page } = await render(stored);

    await type(fixture, page, 'Anyone there?');
    http
      .expectOne({ method: 'POST', url: '/api/messages' })
      .flush({ message: 'Could not reach the AI provider.' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('The AI did not answer');
    expect(page.querySelector('input')!.value).toBe('Anyone there?');
    expect(lines(page)).toHaveLength(2);
  });
});
