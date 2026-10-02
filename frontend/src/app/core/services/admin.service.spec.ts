import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminSettings } from '../models/admin-settings';
import { AdminService } from './admin.service';

const settings: AdminSettings = { aiEnabled: true, aiDailyBudget: 300, aiRequestsToday: 12 };

describe('AdminService', () => {
  let http: HttpTestingController;
  let admin: AdminService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    admin = TestBed.inject(AdminService);
  });

  afterEach(() => http.verify());

  it('loads the settings', async () => {
    const loading = admin.load();
    http.expectOne({ method: 'GET', url: '/api/admin/settings' }).flush(settings);
    await loading;

    expect(admin.settings()).toEqual(settings);
  });

  it('sends only the changed field and keeps what the server returns', async () => {
    const loading = admin.load();
    http.expectOne('/api/admin/settings').flush(settings);
    await loading;

    const saving = admin.update({ aiEnabled: false });
    const req = http.expectOne({ method: 'PATCH', url: '/api/admin/settings' });
    expect(req.request.body).toEqual({ aiEnabled: false });
    req.flush({ ...settings, aiEnabled: false });
    await saving;

    expect(admin.settings()?.aiEnabled).toBe(false);
  });

  it('rejects a refused change and keeps the last saved settings', async () => {
    const loading = admin.load();
    http.expectOne('/api/admin/settings').flush(settings);
    await loading;

    const saving = admin.update({ aiDailyBudget: -1 });
    http
      .expectOne('/api/admin/settings')
      .flush({ message: 'Too low' }, { status: 400, statusText: 'Bad Request' });

    await expect(saving).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(admin.settings()).toEqual(settings);
  });
});
