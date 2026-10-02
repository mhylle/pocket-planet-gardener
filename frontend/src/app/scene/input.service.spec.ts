import { TestBed } from '@angular/core/testing';
import {
  DragInput,
  InputService,
  KeyInput,
  PinchInput,
  TAP_MAX_MS,
  TapInput,
  WheelInput,
} from './input.service';

describe('InputService', () => {
  let input: InputService;
  let canvas: HTMLCanvasElement;
  let drags: DragInput[];
  let dragEnds: number;
  let taps: TapInput[];
  let pinches: PinchInput[];
  let wheels: WheelInput[];
  let keys: KeyInput[];

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [InputService] });
    input = TestBed.inject(InputService);
    canvas = document.createElement('canvas');
    // jsdom has no pointer capture.
    canvas.setPointerCapture = vi.fn();
    document.body.append(canvas);
    input.connect(canvas);
    drags = [];
    dragEnds = 0;
    taps = [];
    pinches = [];
    wheels = [];
    keys = [];
    input.drag.subscribe((drag) => drags.push(drag));
    input.dragEnd.subscribe(() => dragEnds++);
    input.tap.subscribe((tap) => taps.push(tap));
    input.pinch.subscribe((pinch) => pinches.push(pinch));
    input.wheel.subscribe((wheel) => wheels.push(wheel));
    input.key.subscribe((key) => keys.push(key));
  });

  afterEach(() => {
    canvas.remove();
    vi.useRealTimers();
  });

  function pointer(type: string, x: number, y: number, pointerId = 1, button = 0) {
    canvas.dispatchEvent(
      new PointerEvent(type, { pointerId, clientX: x, clientY: y, button, bubbles: true }),
    );
  }

  function key(type: 'keydown' | 'keyup', code: string, value: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent(type, { code, key: value, cancelable: true, ...init });
    canvas.dispatchEvent(event);
    return event;
  }

  describe('pointer', () => {
    it('reads a short press without movement as a tap where it was released', () => {
      pointer('pointerdown', 100, 50);
      pointer('pointermove', 102, 51);
      pointer('pointerup', 102, 51);

      expect(taps).toEqual([{ x: 102, y: 51 }]);
      expect(drags).toEqual([]);
      expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('does not tap after a long press', () => {
      pointer('pointerdown', 100, 50);
      vi.advanceTimersByTime(TAP_MAX_MS + 100);
      pointer('pointerup', 100, 50);

      expect(taps).toEqual([]);
    });

    it('starts a drag once the pointer moves more than 4 px, counting from the press', () => {
      pointer('pointerdown', 100, 50);
      pointer('pointermove', 103, 50);
      expect(drags).toEqual([]);

      pointer('pointermove', 105, 50);
      pointer('pointermove', 110, 47);
      pointer('pointerup', 110, 47);

      expect(drags).toEqual([
        { dx: 5, dy: 0 },
        { dx: 5, dy: -3 },
      ]);
      expect(dragEnds).toBe(1);
      expect(taps).toEqual([]);
    });

    it('ignores moves without a press, and other mouse buttons', () => {
      pointer('pointermove', 100, 50);
      pointer('pointerdown', 100, 50, 1, 2);
      pointer('pointermove', 150, 50);
      pointer('pointerup', 150, 50);

      expect([drags, taps, dragEnds]).toEqual([[], [], 0]);
    });

    it('never taps when the browser cancels the pointer', () => {
      pointer('pointerdown', 100, 50);
      pointer('pointercancel', 100, 50);

      expect(taps).toEqual([]);
    });

    it('reads two fingers moving apart or together as a pinch, without a drag or a tap', () => {
      pointer('pointerdown', 100, 100, 1);
      pointer('pointerdown', 200, 100, 2);
      pointer('pointermove', 250, 100, 2);
      pointer('pointermove', 50, 100, 1);
      pointer('pointermove', 125, 100, 1);
      pointer('pointerup', 125, 100, 1);
      pointer('pointerup', 250, 100, 2);

      expect(pinches.map(({ scale }) => scale)).toEqual([1.5, 200 / 150, 125 / 200]);
      expect([drags, taps, dragEnds]).toEqual([[], [], 0]);
    });

    it('ends a drag when a second finger joins, and lets the last finger drag on', () => {
      pointer('pointerdown', 100, 100, 1);
      pointer('pointermove', 120, 100, 1);
      pointer('pointerdown', 200, 100, 2);
      expect(dragEnds).toBe(1);

      pointer('pointerup', 200, 100, 2);
      pointer('pointermove', 130, 100, 1);
      pointer('pointerup', 130, 100, 1);

      expect(drags).toEqual([
        { dx: 20, dy: 0 },
        { dx: 10, dy: 0 },
      ]);
      expect(dragEnds).toBe(2);
      expect(taps).toEqual([]);
    });

    it('reports a mouse moving over the canvas, pressed or not, and leaving it', () => {
      const hovers: unknown[] = [];
      input.hover.subscribe((hover) => hovers.push(hover));
      const move = (pointerType: string, x: number, y: number) =>
        canvas.dispatchEvent(
          new PointerEvent('pointermove', { pointerId: 1, pointerType, clientX: x, clientY: y }),
        );

      move('mouse', 10, 20);
      pointer('pointerdown', 10, 20);
      move('mouse', 30, 20);
      move('touch', 50, 60);
      canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 1 }));

      expect(hovers).toEqual([{ x: 10, y: 20 }, { x: 30, y: 20 }, null]);
    });

    describe('grabbing', () => {
      let presses: TapInput[];
      let grabMoves: TapInput[];
      let grabEnds: number;

      beforeEach(() => {
        presses = [];
        grabMoves = [];
        grabEnds = 0;
        input.grabMove.subscribe((at) => grabMoves.push(at));
        input.grabEnd.subscribe(() => grabEnds++);
      });

      /** Grabs every press, as a cloud under the pointer would. */
      const grabEveryPress = () =>
        input.pressStart.subscribe((at) => {
          presses.push(at);
          input.grab();
        });

      it('reports where a first press starts, and only the first finger', () => {
        input.pressStart.subscribe((at) => presses.push(at));

        pointer('pointerdown', 100, 50, 1);
        pointer('pointerdown', 200, 50, 2);

        expect(presses).toEqual([{ x: 100, y: 50 }]);
      });

      it('reports every move of a grabbed press, and its end, but never a drag or a tap', () => {
        grabEveryPress();

        pointer('pointerdown', 100, 50);
        pointer('pointermove', 101, 50);
        pointer('pointermove', 140, 60);
        pointer('pointerup', 140, 60);

        expect(grabMoves).toEqual([
          { x: 101, y: 50 },
          { x: 140, y: 60 },
        ]);
        expect(grabEnds).toBe(1);
        expect([drags, dragEnds, taps]).toEqual([[], 0, []]);
      });

      it('ends a grab when a second finger joins or the browser cancels the pointer', () => {
        grabEveryPress();

        pointer('pointerdown', 100, 50, 1);
        pointer('pointerdown', 200, 50, 2);
        expect(grabEnds).toBe(1);
        pointer('pointerup', 200, 50, 2);
        pointer('pointerup', 100, 50, 1);

        pointer('pointerdown', 100, 50, 3);
        pointer('pointercancel', 100, 50, 3);

        expect(grabEnds).toBe(2);
        expect(taps).toEqual([]);
      });

      it('leaves an ungrabbed press to drag and tap as before', () => {
        input.pressStart.subscribe((at) => presses.push(at));

        pointer('pointerdown', 100, 50);
        pointer('pointermove', 110, 50);
        pointer('pointerup', 110, 50);

        expect(drags).toEqual([{ dx: 10, dy: 0 }]);
        expect([grabMoves, grabEnds]).toEqual([[], 0]);
      });
    });
  });

  describe('wheel', () => {
    it('reports the scroll in pixels and keeps the page still', () => {
      const pixels = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
      const lines = new WheelEvent('wheel', { deltaY: -3, deltaMode: 1, cancelable: true });
      canvas.dispatchEvent(pixels);
      canvas.dispatchEvent(lines);

      expect(wheels).toEqual([{ delta: 100 }, { delta: -48 }]);
      expect(pixels.defaultPrevented).toBe(true);
    });
  });

  describe('keys', () => {
    it('reports keys going down and up, keeping arrows from scrolling the page', () => {
      const arrow = key('keydown', 'ArrowLeft', 'ArrowLeft');
      const letter = key('keydown', 'KeyW', 'w');
      key('keyup', 'ArrowLeft', 'ArrowLeft');

      expect(keys).toEqual([
        { code: 'ArrowLeft', key: 'ArrowLeft', down: true },
        { code: 'KeyW', key: 'w', down: true },
        { code: 'ArrowLeft', key: 'ArrowLeft', down: false },
      ]);
      expect(arrow.defaultPrevented).toBe(true);
      expect(letter.defaultPrevented).toBe(false);
    });

    it('leaves shortcuts with Ctrl, Alt or Meta to the browser', () => {
      key('keydown', 'Equal', '+', { ctrlKey: true });
      key('keydown', 'KeyD', 'd', { altKey: true });
      key('keydown', 'KeyS', 's', { metaKey: true });

      expect(keys).toEqual([]);
    });

    it('lets go of held keys when the canvas loses focus', () => {
      key('keydown', 'KeyD', 'd');
      canvas.dispatchEvent(new FocusEvent('blur'));
      key('keyup', 'KeyD', 'd');

      expect(keys).toEqual([
        { code: 'KeyD', key: 'd', down: true },
        { code: 'KeyD', key: 'd', down: false },
      ]);
    });

    it('reports a key up with the key value it went down with', () => {
      key('keydown', 'Equal', '=');
      key('keyup', 'Equal', '+');

      expect(keys.at(-1)).toEqual({ code: 'Equal', key: '=', down: false });
    });

    it('never hears keys pressed elsewhere on the page', () => {
      const field = document.createElement('input');
      document.body.append(field);

      field.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true }));
      field.remove();

      expect(keys).toEqual([]);
    });
  });

  it('stops reporting once disconnected', () => {
    input.disconnect();

    pointer('pointerdown', 100, 50);
    pointer('pointerup', 100, 50);
    key('keydown', 'KeyW', 'w');
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));

    expect([taps, keys, wheels]).toEqual([[], [], []]);
  });
});
