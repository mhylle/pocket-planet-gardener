import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  viewChild,
} from '@angular/core';

/** Keys that do one thing, and what they do. */
export interface Shortcut {
  /** Each key that does it, such as "Enter" and "Space". */
  keys: string[];
  does: string;
}

/** The shortcuts of one part of the screen. */
export interface ShortcutGroup {
  id: string;
  title: string;
  shortcuts: Shortcut[];
}

/** Every key the planet screen answers to (SET-05), by where the focus is. */
export const SHORTCUTS: readonly ShortcutGroup[] = [
  {
    id: 'anywhere',
    title: 'Anywhere',
    shortcuts: [
      {
        keys: ['Tab', 'Shift + Tab'],
        does: 'Go to the next or previous part: the planet, the garden, the sky, then the rest',
      },
      { keys: ['?'], does: 'Show these keys' },
      { keys: ['Esc'], does: 'Close a card or panel' },
    ],
  },
  {
    id: 'planet',
    title: 'On the planet',
    shortcuts: [
      { keys: ['Arrow keys', 'W A S D'], does: 'Turn the planet' },
      { keys: ['+', '-'], does: 'Zoom in or out' },
      {
        keys: ['Enter'],
        does: 'Plant or place what you chose at the ring in the middle, or open the card of what is there',
      },
      { keys: ['Esc'], does: 'Stop planting or placing' },
    ],
  },
  {
    id: 'garden',
    title: 'In the garden list',
    shortcuts: [
      {
        keys: ['Arrow keys'],
        does: 'Pick a creature, plant or decoration; the planet turns to show it',
      },
      { keys: ['Home', 'End'], does: 'Pick the first or the last' },
      { keys: ['Enter', 'Space'], does: 'Open its card, with Chat for a creature' },
      { keys: ['Esc'], does: 'Go back to the planet' },
    ],
  },
  {
    id: 'sky',
    title: 'In the sky list',
    shortcuts: [
      { keys: ['Arrow keys'], does: 'Move the cloud or the sun' },
      { keys: ['Space'], does: 'Make a cloud rain, or stop' },
      { keys: ['Esc'], does: 'Let go and go back to the planet' },
    ],
  },
  {
    id: 'buttons',
    title: 'Inventory, cards and menus',
    shortcuts: [
      {
        keys: ['Enter', 'Space'],
        does: 'Press a button, such as a seed to plant, Move on a decoration or Chat',
      },
    ],
  },
  {
    id: 'chat',
    title: 'In a chat',
    shortcuts: [
      { keys: ['Enter'], does: 'Send' },
      { keys: ['Shift + Enter'], does: 'Start a new line' },
    ],
  },
];

/**
 * The keys of the planet screen (SET-05), opened with "?" or its button. It takes the focus
 * when it opens; Escape or Close closes it, and the focus goes back to where it was. Escape
 * stops here, so it does not also close a card behind.
 */
@Component({
  selector: 'app-shortcut-help',
  templateUrl: './shortcut-help.component.html',
  styleUrl: './shortcut-help.component.scss',
  host: { '(keydown.escape)': 'escape($event)' },
})
export class ShortcutHelpComponent {
  readonly closed = output<void>();

  protected readonly groups = SHORTCUTS;
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  constructor() {
    const returnTo = document.activeElement as HTMLElement | null;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => this.dialog().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => {
      // Only when the focus was in here (or went with it), so a click elsewhere keeps its own.
      const focused = document.activeElement;
      if (!focused || focused === document.body || host.contains(focused)) {
        returnTo?.focus();
      }
    });
  }

  protected escape(event: Event): void {
    event.stopPropagation();
    this.closed.emit();
  }
}
