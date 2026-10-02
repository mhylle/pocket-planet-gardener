import type { Repository } from 'typeorm';
import { FakeClock } from '../../test/support/fake-clock';
import type { AdminSetting } from './admin-setting.entity';
import {
  AdminSettingsService,
  DEFAULT_ADMIN_SETTINGS,
} from './admin-settings.service';
import type { AiUsageService } from './ai-usage.service';

const SECOND_MS = 1000;

/** The service over an in-memory admin_settings table that counts its reads. */
function setup(stored: AdminSetting[] = []) {
  const clock = new FakeClock();
  const table = new Map(stored.map((row) => [row.key, row]));
  const repo = {
    reads: 0,
    find() {
      repo.reads++;
      return Promise.resolve([...table.values()]);
    },
    save(rows: AdminSetting[]) {
      rows.forEach((row) => table.set(row.key, row));
      return Promise.resolve(rows);
    },
  };
  const usage = { countToday: () => Promise.resolve(7) };
  const service = new AdminSettingsService(
    repo as unknown as Repository<AdminSetting>,
    usage as unknown as AiUsageService,
    clock,
  );
  return { clock, table, repo, service };
}

function row(key: string, value: unknown): AdminSetting {
  return { key, value, updatedAt: new Date('2029-12-31T00:00:00.000Z') };
}

describe('AdminSettingsService', () => {
  it('uses the defaults while no row is stored', async () => {
    const { service } = setup();

    await expect(service.aiEnabled()).resolves.toBe(true);
    await expect(service.aiDailyBudget()).resolves.toBe(
      DEFAULT_ADMIN_SETTINGS.aiDailyBudget,
    );
    expect(DEFAULT_ADMIN_SETTINGS).toEqual({
      aiEnabled: true,
      aiDailyBudget: 1000,
    });
  });

  it('reads stored values, and the default for a value of the wrong type', async () => {
    const { service } = setup([
      row('aiEnabled', false),
      row('aiDailyBudget', 'lots'),
    ]);

    await expect(service.aiEnabled()).resolves.toBe(false);
    await expect(service.aiDailyBudget()).resolves.toBe(1000);
  });

  it('hits the database once for reads within 60 s, and again after (ADM-01 AC1)', async () => {
    const { clock, repo, service } = setup([row('aiEnabled', false)]);

    await service.aiEnabled();
    clock.advance(59 * SECOND_MS);
    await service.aiEnabled();
    await service.aiDailyBudget();
    expect(repo.reads).toBe(1);

    clock.advance(2 * SECOND_MS);
    await service.aiEnabled();
    expect(repo.reads).toBe(2);
  });

  it('picks up a change made elsewhere once the minute is over', async () => {
    const { clock, table, service } = setup();
    await expect(service.aiEnabled()).resolves.toBe(true);

    table.set('aiEnabled', row('aiEnabled', false));
    await expect(service.aiEnabled()).resolves.toBe(true);
    clock.advance(61 * SECOND_MS);

    await expect(service.aiEnabled()).resolves.toBe(false);
  });

  it('re-reads when the clock has gone back past the cached read', async () => {
    const { clock, repo, service } = setup();
    await service.aiEnabled();

    clock.advance(-SECOND_MS);
    await service.aiEnabled();

    expect(repo.reads).toBe(2);
  });

  it('stores only the given settings and drops the cache on update', async () => {
    const { clock, table, repo, service } = setup([row('aiDailyBudget', 50)]);
    await service.aiEnabled();

    const view = await service.update({ aiEnabled: false });

    expect(view).toEqual({
      aiEnabled: false,
      aiDailyBudget: 50,
      aiRequestsToday: 7,
    });
    expect(table.get('aiEnabled')).toEqual({
      key: 'aiEnabled',
      value: false,
      updatedAt: clock.now(),
    });
    expect(table.get('aiDailyBudget')?.value).toBe(50);
    expect(repo.reads).toBe(2);
    await expect(service.aiEnabled()).resolves.toBe(false);
    expect(repo.reads).toBe(2);
  });

  it('views the settings with the requests the model answered today', async () => {
    const { service } = setup([row('aiDailyBudget', 0)]);

    await expect(service.view()).resolves.toEqual({
      aiEnabled: true,
      aiDailyBudget: 0,
      aiRequestsToday: 7,
    });
  });
});
