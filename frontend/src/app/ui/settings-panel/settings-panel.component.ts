import {
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { errorMessage } from '../../core/helpers/error-message';
import { PlanetDto } from '../../core/models/planet';
import { ReducedMotionChoice } from '../../core/models/player-settings';
import { PlanetService } from '../../core/services/planet.service';
import { SettingsService } from '../../core/services/settings.service';
import { PlanetNameFormComponent } from '../planet-name-form/planet-name-form.component';

/** Which in-page question is open: leaving, or the first or second delete check (ACC-05 AC1). */
type Question = 'leave' | 'delete' | 'delete-again';

/** The music and the sound effects, each with its own volume and mute (SET-01 AC1). */
const CHANNELS = [
  { id: 'music', name: 'Music', volume: 'musicVolume', muted: 'musicMuted', mute: 'Mute music' },
  {
    id: 'sfx',
    name: 'Sound effects',
    volume: 'sfxVolume',
    muted: 'sfxMuted',
    mute: 'Mute sound effects',
  },
] as const;

type Channel = (typeof CHANNELS)[number];

const MOTION_CHOICES: { value: ReducedMotionChoice; label: string }[] = [
  { value: 'auto', label: 'Auto (follow my device)' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

/**
 * Sound and motion (SET-01, SET-03), planet code for another device (ACC-04), rename (ACC-02
 * AC4), leave and delete (ACC-05). A sound or motion change applies at once and is saved, so
 * it follows the player to any device; a volume is heard while its slider moves and saved once
 * it is let go.
 */
@Component({
  selector: 'app-settings-panel',
  imports: [PlanetNameFormComponent],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.scss',
})
export class SettingsPanelComponent {
  readonly planet = input.required<PlanetDto>();

  private readonly planets = inject(PlanetService);
  private readonly playerSettings = inject(SettingsService);
  private readonly prompt = viewChild<ElementRef<HTMLElement>>('prompt');

  protected readonly channels = CHANNELS;
  protected readonly motionChoices = MOTION_CHOICES;
  protected readonly sound = this.playerSettings.settings;
  protected readonly soundNotice = this.playerSettings.notice;
  protected readonly copyNote = signal('');
  protected readonly renaming = signal(false);
  protected readonly renameError = signal<string | null>(null);
  protected readonly renameNote = signal('');
  protected readonly question = signal<Question | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    // Each question replaces the button that opened it, so move focus to the question itself.
    afterRenderEffect(() => this.prompt()?.nativeElement.focus());
  }

  /** A volume from 0 to 1 as a whole percentage. */
  protected percent(volume: number): number {
    return Math.round(volume * 100);
  }

  /** The slider's volume is heard at once; it is saved when let go. */
  protected slide({ volume }: Channel, field: HTMLInputElement, save: boolean): void {
    const change = { [volume]: Number(field.value) / 100 };
    if (save) {
      this.playerSettings.update(change);
    } else {
      this.playerSettings.preview(change);
    }
  }

  protected mute({ muted }: Channel, muting: boolean): void {
    this.playerSettings.update({ [muted]: muting });
  }

  protected chooseMotion(reducedMotion: ReducedMotionChoice): void {
    this.playerSettings.update({ reducedMotion });
  }

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.planet().code);
      this.copyNote.set('Copied');
    } catch {
      this.copyNote.set("Copying didn't work here. You can select the code and copy it yourself.");
    }
  }

  protected async rename(name: string): Promise<void> {
    this.renaming.set(true);
    this.renameError.set(null);
    this.renameNote.set('');
    try {
      await this.planets.rename(name);
      this.renameNote.set('Name saved.');
    } catch (error) {
      this.renameError.set(errorMessage(error));
    } finally {
      this.renaming.set(false);
    }
  }

  protected ask(question: Question | null): void {
    this.deleteError.set(null);
    this.question.set(question);
  }

  protected leave(): void {
    this.planets.leave();
  }

  protected async deletePlanet(): Promise<void> {
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.planets.deletePlanet();
    } catch (error) {
      this.deleteError.set(errorMessage(error));
    } finally {
      this.deleting.set(false);
    }
  }
}
