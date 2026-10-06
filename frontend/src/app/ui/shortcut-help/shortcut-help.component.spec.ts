import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axeViolations } from '../../testing/axe';
import { SHORTCUTS, ShortcutHelpComponent } from './shortcut-help.component';

/** Opens the help from a button, as the planet page does. */
@Component({
  imports: [ShortcutHelpComponent],
  template: `
    <button type="button" (click)="open.set(true)">Shortcuts</button>
    @if (open()) {
      <app-shortcut-help (closed)="open.set(false)" />
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
}

describe('ShortcutHelpComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  const button = () => host.querySelector<HTMLButtonElement>('button')!;
  const dialog = () => host.querySelector<HTMLElement>('app-shortcut-help [role="dialog"]');
  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();

  async function open() {
    button().focus();
    button().click();
    await fixture.whenStable();
  }

  it('lists every key with what it does, by where the focus is (SET-05)', async () => {
    await open();

    const groups = [...dialog()!.querySelectorAll('h4')].map(text);
    expect(groups).toEqual(SHORTCUTS.map(({ title }) => title));
    const keys = [...dialog()!.querySelectorAll('kbd')].map(text);
    for (const key of ['Tab', '?', 'Esc', 'Arrow keys', 'W A S D', '+', '-', 'Enter', 'Space']) {
      expect(keys).toContain(key);
    }
    expect(text(dialog()!)).toContain('Turn the planet');
    expect(text(dialog()!)).toContain('Open its card, with Chat for a creature');
  });

  it('passes the WCAG 2.1 AA rules (NFR-05)', async () => {
    await open();

    expect(await axeViolations(host)).toEqual([]);
  });

  it('takes the focus, and Escape closes it with the focus back where it was', async () => {
    await open();
    expect(document.activeElement).toBe(dialog());

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    dialog()!.dispatchEvent(escape);
    document.removeEventListener('keydown', behind);
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button());
    // A card behind it stays open.
    expect(behind).not.toHaveBeenCalled();
  });

  it('closes from its Close button', async () => {
    await open();

    dialog()!.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button());
  });
});
