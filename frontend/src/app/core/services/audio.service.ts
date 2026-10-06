import { DOCUMENT, DestroyRef, Injectable, InjectionToken, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SettingsService } from './settings.service';
import { Command, SyncService } from './sync.service';

/**
 * Makes the page's AudioContext, or null where the browser has no Web Audio. Called on the
 * player's first gesture; specs give a fake.
 */
export const AUDIO_CONTEXT = new InjectionToken<() => AudioContext | null>('AUDIO_CONTEXT', {
  providedIn: 'root',
  factory: () => () => (typeof AudioContext === 'function' ? new AudioContext() : null),
});

/** The game's little sounds. */
export type SoundCue = 'plant' | 'rain' | 'harvest' | 'wish' | 'arrival' | 'celebration';

/** How long each step of the music takes, in ms: one soft note, or a rest. */
export const MUSIC_STEP_MS = 1500;

/**
 * The music: a slow tune on the C major pentatonic scale, in Hz per step, 0 for a rest, with a
 * low note joining every eighth step. It loops.
 */
const TUNE = [262, 0, 330, 392, 0, 440, 392, 0, 330, 0, 294, 262, 0, 220, 196, 0];
const BASS = [131, 110];
/** The loudest a music note gets before the music volume, so the music stays in the background. */
const MUSIC_PEAK = 0.06;

/** The input events that let a page start sound under the browsers' autoplay rules. */
const GESTURES = ['pointerup', 'keydown'];

/** One soft note: it swells to its peak, then fades, gliding to another pitch if given one. */
interface Note {
  hz: number;
  glideTo?: number;
  wave: OscillatorType;
  /** Seconds from now. */
  at: number;
  attack: number;
  release: number;
  peak: number;
}

/** Each sound effect but the rain as a few soft notes; none is loud. */
const CUES: Record<Exclude<SoundCue, 'rain'>, Note[]> = {
  // A soft low pop, as a seed goes into the ground.
  plant: [{ hz: 330, glideTo: 196, wave: 'sine', at: 0, attack: 0.01, release: 0.25, peak: 0.3 }],
  // Two quick rising notes.
  harvest: [
    { hz: 659, wave: 'triangle', at: 0, attack: 0.01, release: 0.2, peak: 0.2 },
    { hz: 880, wave: 'triangle', at: 0.1, attack: 0.01, release: 0.3, peak: 0.2 },
  ],
  // A little rising chime.
  wish: [523, 659, 784].map(
    (hz, i): Note => ({ hz, wave: 'sine', at: i * 0.12, attack: 0.01, release: 0.7, peak: 0.18 }),
  ),
  // A gentle swoop up, and a bright note: someone new is here.
  arrival: [
    { hz: 392, glideTo: 587, wave: 'triangle', at: 0, attack: 0.08, release: 0.5, peak: 0.16 },
    { hz: 784, wave: 'sine', at: 0.35, attack: 0.02, release: 0.7, peak: 0.12 },
  ],
  // A quick sparkle of high notes.
  celebration: [784, 880, 1047, 1175, 1568].map(
    (hz, i): Note => ({ hz, wave: 'sine', at: i * 0.07, attack: 0.01, release: 0.5, peak: 0.12 }),
  ),
};

/** The rain: a short hush of noise with the highs taken off, sent once a second while it rains. */
const RAIN = { seconds: 0.6, hz: 1200, peak: 0.08 };

/**
 * Music and sound effects (SET-01), made in the browser with Web Audio, so there are no sound
 * files. Music and sound effects each go through their own channel, whose gain is the volume
 * set, or 0 while muted, applied the moment it changes (AC1). Nothing plays until the player's
 * first click, tap or key press, as browsers ask; then a quiet pentatonic tune loops. Sound
 * effects follow what the server applied: planting, rain, a harvest, and a fulfilled wish or a
 * present; the celebrations add a creature's arrival and a new unlock.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly makeContext = inject(AUDIO_CONTEXT);
  private readonly document = inject(DOCUMENT);
  private context: AudioContext | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private levels = { music: 0, sfx: 0 };
  private step = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly wake = () => this.start();

  constructor() {
    const settings = inject(SettingsService).settings;
    effect(() => {
      const { musicVolume, musicMuted, sfxVolume, sfxMuted } = settings();
      this.levels = { music: musicMuted ? 0 : musicVolume, sfx: sfxMuted ? 0 : sfxVolume };
      this.applyLevels();
    });
    GESTURES.forEach((type) => this.document.addEventListener(type, this.wake, true));

    const sync = inject(SyncService);
    sync.applied.pipe(takeUntilDestroyed()).subscribe((command) => {
      const cue = commandCue(command);
      if (cue) {
        this.play(cue);
      }
    });
    sync.events.pipe(takeUntilDestroyed()).subscribe((events) => {
      if (events.some(({ type }) => type === 'want-fulfilled' || type === 'gift-received')) {
        this.play('wish');
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.stopListening();
      if (this.timer !== null) {
        clearInterval(this.timer);
      }
      this.context?.close().catch(() => undefined);
    });
  }

  /** Plays a sound effect; silent before the player's first gesture and while muted. */
  play(cue: SoundCue): void {
    const sfx = this.sfx;
    if (!sfx || this.levels.sfx === 0) {
      return;
    }
    if (cue === 'rain') {
      this.hush(sfx);
    } else {
      CUES[cue].forEach((note) => this.note(sfx, note));
    }
  }

  /**
   * The first gesture makes the AudioContext and starts the music. A browser may still hold the
   * sound back (some keys do not count as a gesture), so each gesture asks again until it runs.
   */
  private start(): void {
    if (!this.context) {
      this.context = this.makeContext();
      if (!this.context) {
        this.stopListening();
        return;
      }
      this.music = this.channel();
      this.sfx = this.channel();
      this.applyLevels();
      this.timer = setInterval(() => this.playMusic(), MUSIC_STEP_MS);
    }
    if (this.context.state === 'running') {
      this.stopListening();
    } else {
      this.context.resume().catch(() => undefined);
    }
  }

  private stopListening(): void {
    GESTURES.forEach((type) => this.document.removeEventListener(type, this.wake, true));
  }

  private channel(): GainNode {
    const gain = this.context!.createGain();
    gain.connect(this.context!.destination);
    return gain;
  }

  private applyLevels(): void {
    if (this.music && this.sfx) {
      this.music.gain.value = this.levels.music;
      this.sfx.gain.value = this.levels.sfx;
    }
  }

  /** One step of the tune. Skipped while the music is silent, so no notes pile up. */
  private playMusic(): void {
    const step = this.step;
    this.step = (step + 1) % TUNE.length;
    if (this.context!.state !== 'running' || this.levels.music === 0) {
      return;
    }
    const soft = { at: 0, peak: MUSIC_PEAK };
    if (TUNE[step]) {
      this.note(this.music!, { ...soft, hz: TUNE[step], wave: 'sine', attack: 0.6, release: 3 });
    }
    if (step % 8 === 0) {
      const hz = BASS[step / 8];
      this.note(this.music!, { ...soft, hz, wave: 'triangle', attack: 1, release: 5 });
    }
  }

  private note(out: AudioNode, { hz, glideTo, wave, at, attack, release, peak }: Note): void {
    const context = this.context!;
    const start = context.currentTime + at;
    const end = start + attack + release;
    const oscillator = context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(hz, start);
    if (glideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(glideTo, end);
    }
    oscillator.connect(this.envelope(start, attack, end, peak)).connect(out);
    oscillator.start(start);
    oscillator.stop(end);
  }

  /** A moment of rain: a hush of noise with the highs taken off. */
  private hush(out: AudioNode): void {
    const context = this.context!;
    const start = context.currentTime;
    const end = start + RAIN.seconds;
    const source = context.createBufferSource();
    source.buffer = this.noise ??= whiteNoise(context);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = RAIN.hz;
    source.connect(filter).connect(this.envelope(start, 0.1, end, RAIN.peak)).connect(out);
    source.start(start);
    source.stop(end);
  }

  /** A gain that swells from silence to the peak, then fades away by the end. */
  private envelope(start: number, attack: number, end: number, peak: number): GainNode {
    const gain = this.context!.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    return gain;
  }
}

/** The sound for a command the server applied; null for one without a sound. */
function commandCue({ method, path }: Command): SoundCue | null {
  if (method !== 'POST') {
    return null;
  }
  if (path === '/garden/plants') {
    return 'plant';
  }
  if (path === '/garden/rain') {
    return 'rain';
  }
  return /^\/garden\/plants\/[^/]+\/harvest$/.test(path) ? 'harvest' : null;
}

/** A second of white noise. */
function whiteNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }
  return buffer;
}
