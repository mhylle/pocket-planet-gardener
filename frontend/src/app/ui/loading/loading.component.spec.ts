import { TestBed } from '@angular/core/testing';
import { LoadingComponent } from './loading.component';

describe('LoadingComponent', () => {
  it("says what Pip is doing in a status, with Pip's picture hidden from screen readers", async () => {
    const fixture = TestBed.createComponent(LoadingComponent);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;

    expect(page.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Pip is fetching your planet…',
    );
    expect(page.querySelector('.pip')?.getAttribute('aria-hidden')).toBe('true');
  });
});
