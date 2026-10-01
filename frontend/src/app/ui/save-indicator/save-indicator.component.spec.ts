import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SaveIndicatorComponent } from './save-indicator.component';

describe('SaveIndicatorComponent', () => {
  let fixture: ComponentFixture<SaveIndicatorComponent>;
  let page: HTMLElement;
  let store: PlanetStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SaveIndicatorComponent] });
    store = TestBed.inject(PlanetStore);
    fixture = TestBed.createComponent(SaveIndicatorComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  const region = () => page.querySelector('[aria-live]')!;
  const note = () => region().textContent!.trim();

  it('keeps an empty polite live region while there is nothing to say', () => {
    expect(region().getAttribute('aria-live')).toBe('polite');
    expect(region().getAttribute('role')).toBe('status');
    expect(note()).toBe('');
  });

  it('says saving with an icon while commands are pending', async () => {
    store.setPendingCommands(2);
    await fixture.whenStable();

    expect(note()).toBe('Saving…');
    expect(region().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says offline with an icon, and that changes will be saved later', async () => {
    store.setPendingCommands(1);
    store.setOffline(true);
    await fixture.whenStable();

    expect(note()).toBe("Offline — your changes will be saved when you're back");
    expect(region().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('disappears once saving succeeds', async () => {
    store.setPendingCommands(1);
    store.setOffline(true);
    await fixture.whenStable();

    store.setOffline(false);
    store.setPendingCommands(0);
    await fixture.whenStable();

    expect(note()).toBe('');
    expect(region().querySelector('svg')).toBeNull();
  });
});
