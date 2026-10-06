import { Provider } from '@angular/core';
import { AUDIO_CONTEXT } from '../core/services/audio.service';

/** An AudioParam that keeps its value and lets every scheduled change pass. */
class FakeParam {
  constructor(public value: number) {}
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
}

/** An AudioNode that remembers what it is connected to. */
class FakeNode {
  readonly outputs: FakeNode[] = [];
  connect<T extends FakeNode>(node: T): T {
    this.outputs.push(node);
    return node;
  }
  /** True when the sound from this node ends up in the target. */
  reaches(target: FakeNode): boolean {
    return this.outputs.some((node) => node === target || node.reaches(target));
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

/** An oscillator or a noise source; started says it was played. */
export class FakeSource extends FakeNode {
  type = '';
  buffer: unknown = null;
  readonly frequency = new FakeParam(440);
  started = false;
  start(): void {
    this.started = true;
  }
  stop(): void {
    // Nothing to stop in a fake.
  }
}

/**
 * A stand-in for the browser's AudioContext: it builds nodes that only remember how they are
 * wired, so a spec can tell the channels' volumes and what was played on each.
 */
export class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime = 0;
  /** Low, so a second of noise is quick to make. */
  readonly sampleRate = 100;
  readonly destination = new FakeNode();
  private readonly gains: FakeGain[] = [];
  private readonly sources: FakeSource[] = [];

  /** The gains wired straight to the speakers, in the order made: music, then sound effects. */
  get channels(): FakeGain[] {
    return this.gains.filter((gain) => gain.outputs.includes(this.destination));
  }

  /** The sounds started on the channel. */
  playedOn(channel: FakeGain): FakeSource[] {
    return this.sources.filter((source) => source.started && source.reaches(channel));
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeSource {
    return this.source();
  }

  createBufferSource(): FakeSource {
    return this.source();
  }

  createBiquadFilter(): FakeSource {
    return new FakeSource();
  }

  createBuffer(_channels: number, length: number): { getChannelData: () => Float32Array } {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  private source(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
}

/** Provides the factory AudioService makes its context with, handing out the fake. */
export function provideFakeAudio(context: FakeAudioContext): Provider {
  return { provide: AUDIO_CONTEXT, useValue: () => context as unknown as AudioContext };
}
