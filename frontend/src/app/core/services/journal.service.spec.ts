import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JournalPageDto } from '../models/journal';
import { JournalService } from './journal.service';
import { PlanetIdentityService } from './planet-identity.service';

const page: JournalPageDto = {
  entries: [
    {
      id: 'entry-1',
      text: 'The clover bloomed.',
      source: 'ai',
      createdAt: '2026-10-02T12:00:00.000Z',
      coversFrom: '2026-10-02T06:00:00.000Z',
      coversTo: '2026-10-02T12:00:00.000Z',
      milestones: [],
    },
  ],
  hasMore: true,
};

describe('JournalService', () => {
  let http: HttpTestingController;
  let journal: JournalService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    journal = TestBed.inject(JournalService);
    TestBed.inject(PlanetIdentityService).set('planet-1');
  });

  afterEach(() => http.verify());

  it("loads the newest entries of this planet's journal", async () => {
    const loading = journal.page();
    const request = http.expectOne({ method: 'GET', url: '/api/journal' });
    expect(request.request.headers.get('X-Planet-Id')).toBe('planet-1');
    request.flush(page);

    expect(await loading).toEqual(page);
  });

  it('loads the entries written before a timestamp', async () => {
    const loading = journal.page('2026-10-02T12:00:00.000Z');
    http
      .expectOne({ method: 'GET', url: '/api/journal?before=2026-10-02T12%3A00%3A00.000Z' })
      .flush(page);

    expect(await loading).toEqual(page);
  });

  it('rejects with the error response when the request fails', async () => {
    const loading = journal.page();
    http
      .expectOne('/api/journal')
      .flush({ message: 'down' }, { status: 500, statusText: 'Server Error' });

    await expect(loading).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
