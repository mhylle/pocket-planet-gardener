import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** A drag step in CSS pixels since the previous one; y grows downwards. */
export interface DragInput {
  dx: number;
  dy: number;
}

/** A tap, in CSS pixels from the canvas's top left. */
export interface TapInput {
  x: number;
  y: number;
}

/** A pinch step: the finger spread now divided by the spread at the previous step. */
export interface PinchInput {
  scale: number;
}

/** A wheel step in pixels; positive scrolls away from the planet. */
export interface WheelInput {
  delta: number;
}

/**
 * A key going down (again on auto-repeat) or up. code names the physical key, so W/A/S/D work
 * on any layout; key is the character, so plus and minus work wherever they are.
 */
export interface KeyInput {
  code: string;
  key: string;
  down: boolean;
}

/** Moving further than this, in CSS pixels, turns a press into a drag. */
export const DRAG_THRESHOLD_PX = 4;
/** A press released within this time without dragging is a tap. */
export const TAP_MAX_MS = 500;

const PIXELS_PER_WHEEL_LINE = 16;
const PIXELS_PER_WHEEL_PAGE = 800;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

/** One finger or the mouse, held down. */
interface Press {
  pointerId: number;
  startX: number;
  startY: number;
  /** Where the last drag step ended. */
  lastX: number;
  lastY: number;
  startTime: number;
  dragging: boolean;
  /** False for the finger left over from a pinch. */
  canTap: boolean;
}

/**
 * Turns pointer (mouse, touch, pen) and keyboard events on the canvas into plain gestures.
 * Keys arrive only while the canvas has focus, so typing elsewhere is never taken over. A
 * second finger ends a drag and starts a pinch; a gesture that had two fingers never taps.
 */
@Injectable()
export class InputService {
  private readonly drags = new Subject<DragInput>();
  private readonly dragEnds = new Subject<void>();
  private readonly taps = new Subject<TapInput>();
  private readonly pinches = new Subject<PinchInput>();
  private readonly wheels = new Subject<WheelInput>();
  private readonly keys = new Subject<KeyInput>();

  readonly drag = this.drags.asObservable();
  /** The finger or button that was dragging let go, or a second finger joined. */
  readonly dragEnd = this.dragEnds.asObservable();
  readonly tap = this.taps.asObservable();
  readonly pinch = this.pinches.asObservable();
  readonly wheel = this.wheels.asObservable();
  readonly key = this.keys.asObservable();

  private canvas: HTMLCanvasElement | null = null;
  private listeners: AbortController | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private press: Press | null = null;
  private pinchSpan: number | null = null;
  private hadTwoPointers = false;
  /** The key value each held key went down with, by code. */
  private readonly heldKeys = new Map<string, string>();

  connect(canvas: HTMLCanvasElement): void {
    this.disconnect();
    this.canvas = canvas;
    this.listeners = new AbortController();
    const signal = this.listeners.signal;
    canvas.addEventListener('pointerdown', (event) => this.pointerDown(event), { signal });
    canvas.addEventListener('pointermove', (event) => this.pointerMove(event), { signal });
    canvas.addEventListener('pointerup', (event) => this.pointerUp(event, true), { signal });
    canvas.addEventListener('pointercancel', (event) => this.pointerUp(event, false), { signal });
    // Not passive, so the page does not scroll as well.
    canvas.addEventListener('wheel', (event) => this.onWheel(event), { signal, passive: false });
    canvas.addEventListener('keydown', (event) => this.keyDown(event), { signal });
    canvas.addEventListener('keyup', (event) => this.keyUp(event), { signal });
    canvas.addEventListener('blur', () => this.releaseKeys(), { signal });
  }

  disconnect(): void {
    this.listeners?.abort();
    this.listeners = null;
    this.canvas = null;
    this.pointers.clear();
    this.press = null;
    this.pinchSpan = null;
    this.heldKeys.clear();
  }

  private pointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.pointers.size === 2) {
      return;
    }
    // Keeps the moves coming when the pointer leaves the canvas mid-drag.
    this.canvas?.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, this.position(event));
    if (this.pointers.size === 1) {
      this.hadTwoPointers = false;
      this.startPress(event.pointerId, event.timeStamp);
      return;
    }
    if (this.press?.dragging) {
      this.dragEnds.next();
    }
    this.press = null;
    this.hadTwoPointers = true;
    this.pinchSpan = this.span();
  }

  private pointerMove(event: PointerEvent): void {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) {
      return;
    }
    Object.assign(pointer, this.position(event));
    if (this.pointers.size === 2) {
      const span = this.span();
      if (this.pinchSpan && span > 0) {
        this.pinches.next({ scale: span / this.pinchSpan });
      }
      this.pinchSpan = span;
      return;
    }
    const press = this.press;
    if (!press) {
      return;
    }
    const moved = Math.hypot(pointer.x - press.startX, pointer.y - press.startY);
    if (!press.dragging && moved <= DRAG_THRESHOLD_PX) {
      return;
    }
    press.dragging = true;
    this.drags.next({ dx: pointer.x - press.lastX, dy: pointer.y - press.lastY });
    press.lastX = pointer.x;
    press.lastY = pointer.y;
  }

  /** A pointer lifted (released true) or the browser took it over (released false). */
  private pointerUp(event: PointerEvent, released: boolean): void {
    if (!this.pointers.delete(event.pointerId)) {
      return;
    }
    const press = this.press;
    if (press?.pointerId === event.pointerId) {
      this.press = null;
      if (press.dragging) {
        this.dragEnds.next();
      } else if (released && press.canTap && event.timeStamp - press.startTime <= TAP_MAX_MS) {
        this.taps.next(this.position(event));
      }
    }
    this.pinchSpan = null;
    // The finger left after a pinch may drag on from where it is, but never taps.
    const [remaining] = this.pointers.keys();
    if (remaining !== undefined) {
      this.startPress(remaining, event.timeStamp);
    }
  }

  private startPress(pointerId: number, time: number): void {
    const { x, y } = this.pointers.get(pointerId)!;
    this.press = {
      pointerId,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      startTime: time,
      dragging: false,
      canTap: !this.hadTwoPointers,
    };
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const unit =
      event.deltaMode === DOM_DELTA_LINE
        ? PIXELS_PER_WHEEL_LINE
        : event.deltaMode === DOM_DELTA_PAGE
          ? PIXELS_PER_WHEEL_PAGE
          : 1;
    this.wheels.next({ delta: event.deltaY * unit });
  }

  private keyDown(event: KeyboardEvent): void {
    // Shortcuts such as Ctrl and plus (the browser's own zoom) stay with the browser.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key.startsWith('Arrow')) {
      // The page would scroll as well.
      event.preventDefault();
    }
    this.heldKeys.set(event.code, event.key);
    this.keys.next({ code: event.code, key: event.key, down: true });
  }

  private keyUp(event: KeyboardEvent): void {
    // Shift may have changed the key value since it went down, so report the one it had.
    const key = this.heldKeys.get(event.code);
    if (key !== undefined) {
      this.heldKeys.delete(event.code);
      this.keys.next({ code: event.code, key, down: false });
    }
  }

  /** Focus left the canvas, so its key-ups would go elsewhere: let go of every held key. */
  private releaseKeys(): void {
    for (const [code, key] of this.heldKeys) {
      this.keys.next({ code, key, down: false });
    }
    this.heldKeys.clear();
  }

  private position(event: PointerEvent): { x: number; y: number } {
    const box = this.canvas!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  /** The distance between the two pointers. */
  private span(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
