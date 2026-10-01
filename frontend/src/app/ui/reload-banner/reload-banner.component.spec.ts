import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageReloadService } from '../../core/services/page-reload.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { ReloadBannerComponent } from './reload-banner.component';

describe('ReloadBannerComponent', () => {
  let fixture: ComponentFixture<ReloadBannerComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [ReloadBannerComponent] });
    fixture = TestBed.createComponent(ReloadBannerComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  const banner = () => page.querySelector('[role="alert"]');

  it('shows nothing while this copy of the planet is current', () => {
    expect(banner()).toBeNull();
  });

  it('asks for a reload and reloads the page on request', async () => {
    const reload = vi
      .spyOn(TestBed.inject(PageReloadService), 'reload')
      .mockImplementation(() => undefined);
    TestBed.inject(PlanetStore).requireReload();
    await fixture.whenStable();

    expect(banner()?.textContent).toContain(
      'This planet changed on another device. Reload to see the latest.',
    );
    banner()!.querySelector('button')!.click();

    expect(reload).toHaveBeenCalledOnce();
  });
});
