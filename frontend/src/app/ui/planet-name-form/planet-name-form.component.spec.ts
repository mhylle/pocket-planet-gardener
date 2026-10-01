import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_GAME_CONFIG } from '../../core/models/game-config';
import { GameConfigService } from '../../core/services/game-config.service';
import { PlanetNameFormComponent } from './planet-name-form.component';

describe('PlanetNameFormComponent', () => {
  let fixture: ComponentFixture<PlanetNameFormComponent>;
  let page: HTMLElement;
  let saved: string[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PlanetNameFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PlanetNameFormComponent);
    fixture.componentRef.setInput('label', 'Planet name');
    fixture.componentRef.setInput('submitLabel', 'Create my planet');
    saved = [];
    fixture.componentInstance.save.subscribe((name) => saved.push(name));
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  const field = () => page.querySelector('input')!;
  const submit = () => page.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const count = () => page.querySelector('.count')!.textContent!.trim();
  const error = () => page.querySelector('[aria-live="polite"]')!.textContent!.trim();

  async function type(value: string) {
    field().value = value;
    field().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('labels the input', () => {
    const label = page.querySelector('label')!;

    expect(label.textContent!.trim()).toBe('Planet name');
    expect(label.htmlFor).toBe(field().id);
  });

  it('counts an emoji as one character', async () => {
    await type('🌱');
    expect(count()).toBe('1 / 24');
    expect(submit().disabled).toBe(true);

    await type('🌱a');
    expect(count()).toBe('2 / 24');
    expect(submit().disabled).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['one character', 'a'],
    ['only spaces', '      '],
    ['25 characters', 'x'.repeat(25)],
  ])('disables submit when the name is %s', async (_label, value) => {
    await type(value);

    expect(submit().disabled).toBe(true);
  });

  it.each([
    ['2 characters', 'ab'],
    ['24 characters', 'x'.repeat(24)],
    ['24 characters plus surrounding spaces', `  ${'x'.repeat(24)}  `],
  ])('enables submit for %s', async (_label, value) => {
    await type(value);

    expect(submit().disabled).toBe(false);
  });

  it('counts and emits the trimmed name', async () => {
    await type('  Mossy  ');
    expect(count()).toBe('5 / 24');

    submit().click();

    expect(saved).toEqual(['Mossy']);
  });

  it('does not emit when Enter submits an invalid name', async () => {
    await type('a');

    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(saved).toEqual([]);
  });

  it('shows the error in a live region and keeps what was typed', async () => {
    await type('Grumpy');

    fixture.componentRef.setInput('error', 'Let us pick a kinder name');
    await fixture.whenStable();

    expect(error()).toBe('Let us pick a kinder name');
    expect(field().value).toBe('Grumpy');
    expect(field().getAttribute('aria-invalid')).toBe('true');
  });

  it('disables submit while busy', async () => {
    await type('Mossy');

    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect(submit().disabled).toBe(true);
  });

  it('starts from the initial name', async () => {
    fixture.componentRef.setInput('initialName', 'Fernhill');
    await fixture.whenStable();

    expect(field().value).toBe('Fernhill');
    expect(count()).toBe('8 / 24');
  });

  it('follows the limits from the game config', async () => {
    TestBed.inject(GameConfigService).load();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/config')
      .flush({ ...DEFAULT_GAME_CONFIG, planetNameMin: 3, planetNameMax: 10 });

    await type('ab');
    expect(count()).toBe('2 / 10');
    expect(submit().disabled).toBe(true);

    await type('x'.repeat(11));
    expect(submit().disabled).toBe(true);

    await type('abc');
    expect(submit().disabled).toBe(false);
  });
});
