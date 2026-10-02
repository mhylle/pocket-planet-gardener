import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminSettings } from '../../core/models/admin-settings';
import { AdminComponent, BUDGET_RULE } from './admin.component';

const settings: AdminSettings = { aiEnabled: true, aiDailyBudget: 300, aiRequestsToday: 12 };

describe('AdminComponent', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  /** Lets pending promise callbacks run, then waits for the re-render. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function open(loaded = settings) {
    http.expectOne({ method: 'GET', url: '/api/admin/settings' }).flush(loaded);
    await settle();
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.trim();
  const toggle = () => page.querySelector<HTMLButtonElement>('button.switch')!;

  async function saveBudget(value: string) {
    page.querySelector<HTMLInputElement>('#ai-budget')!.value = value;
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
  }

  it('loads the settings on open and shows the switch, the budget and the requests today', async () => {
    expect(text('.hint')).toBe('Loading the settings…');

    await open();

    expect(text('h2')).toBe('Game owner');
    expect(toggle().textContent?.trim()).toBe('AI features are on');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().querySelector('svg')).not.toBeNull();
    expect(text('#ai-switch-hint')).toBe(
      'Players get the cosy fallbacks within a minute when AI is off.',
    );
    expect(page.querySelector<HTMLInputElement>('#ai-budget')!.value).toBe('300');
    expect(page.querySelector('label[for="ai-budget"]')?.textContent).toBe('Daily AI budget');
    expect(text('.usage')).toBe('AI requests today: 12 of 300');
  });

  it('says the page is open to anyone in the proof of concept (D-0)', async () => {
    await open();

    expect(text('.open-note')).toContain('this page is open to anyone');
  });

  it('switches AI off straight away and shows the saved state', async () => {
    await open();

    toggle().click();
    const req = http.expectOne({ method: 'PATCH', url: '/api/admin/settings' });
    expect(req.request.body).toEqual({ aiEnabled: false });
    req.flush({ ...settings, aiEnabled: false });
    await settle();

    expect(toggle().textContent?.trim()).toBe('AI features are off');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(text('[role="status"]')).toBe('Saved: AI features are off.');
  });

  it('keeps the shown state and explains when switching fails', async () => {
    await open();

    toggle().click();
    http
      .expectOne('/api/admin/settings')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    await settle();

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(text('#ai-switch-error')).toContain('Please try again');
    expect(text('[role="status"]')).toBe('');
  });

  it('saves the daily budget', async () => {
    await open();

    await saveBudget('500');
    const req = http.expectOne({ method: 'PATCH', url: '/api/admin/settings' });
    expect(req.request.body).toEqual({ aiDailyBudget: 500 });
    req.flush({ ...settings, aiDailyBudget: 500 });
    await settle();

    expect(text('.usage')).toBe('AI requests today: 12 of 500');
    expect(text('[role="status"]')).toBe('Saved: the daily AI budget is 500.');
  });

  it.each(['-1', '2.5', ''])('refuses the budget %j without asking the server', async (value) => {
    await open();

    await saveBudget(value);

    http.expectNone('/api/admin/settings');
    expect(text('#ai-budget-error')).toBe(BUDGET_RULE);
    expect(page.querySelector('#ai-budget')?.getAttribute('aria-invalid')).toBe('true');
  });

  it("shows the server's message when it refuses the budget", async () => {
    await open();

    await saveBudget('500');
    http
      .expectOne('/api/admin/settings')
      .flush(
        { statusCode: 400, message: ['aiDailyBudget must not be greater than 100000'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(text('#ai-budget-error')).toBe('aiDailyBudget must not be greater than 100000');
    expect(text('.usage')).toBe('AI requests today: 12 of 300');
  });

  it('shows a calm message when the settings cannot load', async () => {
    http
      .expectOne('/api/admin/settings')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    await settle();

    expect(text('[role="alert"]')).toContain('Please try again');
    expect(page.querySelector('button.switch')).toBeNull();
  });
});
