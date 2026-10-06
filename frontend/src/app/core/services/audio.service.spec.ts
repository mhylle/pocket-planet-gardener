import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MOSSY, creatureAt, giftReceived, wantFulfilled } from '../../testing/garden-fixtures';
import { FakeAudioContext, provideFakeAudio } from '../../testing/fake-audio-context';
import { EventDto } from '../models/planet-snapshot';
import { PlayerSettings } from '../models/player-settings';
import { AUDIO_CONTEXT, AudioService, MUSIC_STEP_MS } from './audio.service';
import { PlanetStore } from './planet-store.service';
import { SettingsService } from './settings.service';
import { Command, SyncService } from './sync.service';

describe('AudioService', () => {
  let context: FakeAudioContext;
  let http: HttpTestingController;
  let audio: AudioService;

  beforeEach(() => {
    vi.useFakeTimers();
    context = new FakeAudioContext();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideFakeAudio(context)],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlanetStore).setSnapshot(MOSSY);
    audio = TestBed.inject(AudioService);
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  /** The player clicks, taps or presses a key somewhere on the page. */
  const gesture = (type = 'pointerup') => document.dispatchEvent(new Event(type));
  /** The player changes the settings; the change applies without a reload. */
  const set = (change: Partial<PlayerSettings>) => {
    TestBed.inject(SettingsService).preview(change);
    TestBed.tick();
  };
  const music = () => context.channels[0];
  const sfx = () => context.channels[1];
  const musicSteps = (steps: number) => vi.advanceTimersByTime(steps * MUSIC_STEP_MS);

  /** The server applies a command, with what it says happened. */
  async function applied(command: Command, events: EventDto[] = []) {
    const sending = TestBed.inject(SyncService).send(command);
    http.expectOne(`/api${command.path}`).flush({ snapshot: MOSSY, events });
    await sending;
  }

  describe('before the first gesture', () => {
    it('makes no sound at all, as browsers ask', async () => {
      audio.play('plant');
      await applied({ method: 'POST', path: '/garden/plants', body: {} });
      musicSteps(10);

      expect(context.channels).toEqual([]);
    });

    it('applies settings made meanwhile once the sound starts', () => {
      set({ musicVolume: 0.3, sfxMuted: true });

      gesture();

      expect(music().gain.value).toBe(0.3);
      expect(sfx().gain.value).toBe(0);
    });
  });

  describe('after the first gesture', () => {
    beforeEach(() => gesture());

    it('sets each channel to its volume, music and sound effects apart', () => {
      expect(context.channels).toHaveLength(2);
      expect(music().gain.value).toBe(0.6);
      expect(sfx().gain.value).toBe(0.8);
    });

    it('plays a quiet tune that loops', () => {
      musicSteps(1);
      expect(context.playedOn(music()).length).toBeGreaterThan(0);

      const firstLoop = context.playedOn(music()).length;
      musicSteps(16);
      expect(context.playedOn(music()).length).toBeGreaterThan(firstLoop);
      expect(context.playedOn(sfx())).toEqual([]);
    });

    it('turns the music to a new volume at once (SET-01 AC1)', () => {
      set({ musicVolume: 0.3 });

      expect(music().gain.value).toBe(0.3);
      expect(sfx().gain.value).toBe(0.8);
    });

    it('silences muted music and brings its volume back on unmute', () => {
      set({ musicVolume: 0.3 });

      set({ musicMuted: true });
      expect(music().gain.value).toBe(0);

      set({ musicMuted: false });
      expect(music().gain.value).toBe(0.3);
    });

    it('sets the sound effects apart from the music', () => {
      set({ sfxVolume: 0.25 });
      expect(sfx().gain.value).toBe(0.25);
      expect(music().gain.value).toBe(0.6);

      set({ sfxMuted: true });
      expect(sfx().gain.value).toBe(0);
      expect(music().gain.value).toBe(0.6);
    });

    it('plays no music notes while it is muted, so none pile up', () => {
      set({ musicMuted: true });
      musicSteps(10);
      expect(context.playedOn(music())).toEqual([]);

      set({ musicMuted: false });
      musicSteps(2);
      expect(context.playedOn(music()).length).toBeGreaterThan(0);
    });

    it('plays a sound effect on the sound-effect channel only', () => {
      audio.play('wish');

      expect(context.playedOn(sfx())).toHaveLength(3);
      expect(context.playedOn(music())).toEqual([]);
    });

    it('plays rain as a soft hush of noise', () => {
      audio.play('rain');

      const [hush] = context.playedOn(sfx());
      expect(hush.buffer).not.toBeNull();
    });

    it('plays no sound effects while they are muted', () => {
      set({ sfxMuted: true });

      audio.play('celebration');

      expect(context.playedOn(sfx())).toEqual([]);
    });

    it('sounds the commands the server applied: plant, rain and harvest', async () => {
      const played = () => context.playedOn(sfx()).length;

      await applied({ method: 'POST', path: '/garden/plants', body: {} });
      expect(played()).toBe(1);
      await applied({ method: 'POST', path: '/garden/rain', body: {} });
      expect(played()).toBe(2);
      await applied({ method: 'POST', path: '/garden/plants/p-1/harvest', body: {} });
      expect(played()).toBe(4);

      // Moving a decoration has no sound.
      await applied({ method: 'PATCH', path: '/garden/decorations/d-1/position', body: {} });
      expect(played()).toBe(4);
    });

    it('chimes for a fulfilled wish or a present in any response', async () => {
      const mira = creatureAt('mira', 5, 5);

      await applied({ method: 'POST', path: '/garden/sun', body: {} }, [wantFulfilled(mira)]);
      expect(context.playedOn(sfx())).toHaveLength(3);

      await applied({ method: 'POST', path: '/garden/sun', body: {} }, [giftReceived(mira)]);
      expect(context.playedOn(sfx())).toHaveLength(6);
    });
  });

  it('counts a key press as a gesture too', () => {
    gesture('keydown');

    expect(context.channels).toHaveLength(2);
  });

  it('asks a held-back context to start on each gesture until it runs', () => {
    context.state = 'suspended';
    const resume = vi.spyOn(context, 'resume');

    gesture();
    expect(resume).toHaveBeenCalledOnce();
    expect(context.state).toBe('running');

    gesture();
    gesture();
    expect(resume).toHaveBeenCalledOnce();
  });

  it('closes the sound when the app goes', () => {
    gesture();

    TestBed.resetTestingModule();

    expect(context.state).toBe('closed');
  });
});

describe('AUDIO_CONTEXT', () => {
  it('makes no context where the browser has no Web Audio, as in jsdom', () => {
    expect(TestBed.inject(AUDIO_CONTEXT)()).toBeNull();
  });
});
