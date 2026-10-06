import { TestBed } from '@angular/core/testing';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../../testing/fake-motion';
import { LoadingComponent } from './loading.component';

describe('LoadingComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FAKE_MOTION_PROVIDERS] });
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(LoadingComponent);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it("says what Pip is doing in a status, with Pip's picture hidden from screen readers", async () => {
    const page = await render();

    expect(page.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Pip is fetching your planet…',
    );
    expect(page.querySelector('app-pip-cloud')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lets Pip bob, unless motion is reduced (SET-03)', async () => {
    expect((await render()).querySelector('app-pip-cloud')?.classList).not.toContain('still');

    TestBed.inject(FakeMotionPreference).reduced.set(true);

    expect((await render()).querySelector('app-pip-cloud')?.classList).toContain('still');
  });
});
