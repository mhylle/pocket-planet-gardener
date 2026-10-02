import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { MockInstance } from 'vitest';
import { CreatureDto } from '../../core/models/creature';
import { PlantDto } from '../../core/models/planet-snapshot';
import { CatalogueService } from '../../core/services/catalogue.service';
import { ChatService } from '../../core/services/chat.service';
import { CardTarget, PlacementService } from '../../core/services/placement.service';
import { PlanetIdentityService } from '../../core/services/planet-identity.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { SkyService } from '../../scene/sky.service';
import { CATALOGUE, CLOVER_WANT, MOSSY, creatureAt, plantAt } from '../../testing/garden-fixtures';
import { InfoCardComponent } from './info-card.component';

const plant = (id: string): CardTarget => ({ kind: 'plant', id, x: 300, y: 200 });
const rock: CardTarget = { kind: 'decoration', id: 'rock-1', x: 300, y: 200 };

describe('InfoCardComponent', () => {
  let fixture: ComponentFixture<InfoCardComponent>;
  let http: HttpTestingController;
  let placement: PlacementService;
  let focusCanvas: MockInstance<SceneService['focusCanvas']>;
  let page: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [InfoCardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        PlacementService,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CatalogueService).load();
    http.expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(PlanetIdentityService).set(MOSSY.id);
    plantOn([plantAt('clover-1', 0, 0, { stage: 'sprout' })]);
    const scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    focusCanvas = vi.spyOn(scene, 'focusCanvas');
    // Half light at 0, 0: right for the clover, too much for a mushroom.
    TestBed.inject(SkyService).holdSun(60);
    placement = TestBed.inject(PlacementService);
    fixture = TestBed.createComponent(InfoCardComponent);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function plantOn(plants: PlantDto[]) {
    TestBed.inject(PlanetStore).setSnapshot({
      ...MOSSY,
      plants,
      decorations: [{ id: 'rock-1', type: 'rock', lat: 10, lon: 10 }],
    });
  }

  async function pin(target: CardTarget) {
    placement.openCard(target);
    await fixture.whenStable();
  }

  async function hover(target: CardTarget | null) {
    placement.setHoverCard(target);
    await fixture.whenStable();
  }

  const card = () => page.querySelector<HTMLElement>('.card[role="dialog"]');
  const title = () => card()?.querySelector('h3')?.textContent?.trim();
  const statuses = () =>
    [...page.querySelectorAll('.statuses li')].map((each) => ({
      icon: each.querySelector('svg')?.getAttribute('data-icon'),
      text: each.textContent!.trim(),
    }));
  const button = (text: string) =>
    [...page.querySelectorAll('button')].find((each) => each.textContent!.trim() === text)!;
  const labels = () => [...page.querySelectorAll('button')].map((each) => each.textContent!.trim());

  describe('hovering (NAV-03 AC1, AC3)', () => {
    it("shows a plant's type, stage, water and light as icon and words, with no actions", async () => {
      await hover(plant('clover-1'));

      expect(card()).not.toBeNull();
      expect(card()!.getAttribute('aria-labelledby')).toBe('info-card-title');
      expect(title()).toBe('Clover');
      expect(statuses()).toEqual([
        { icon: 'sprout', text: 'Sprout' },
        { icon: 'drop-full', text: 'Happy' },
        { icon: 'sun-check', text: 'Just the right light' },
      ]);
      expect(labels()).toEqual([]);
      expect(card()!.classList.contains('pinned')).toBe(false);
    });

    it('shows a thirsty plant with the water icon and what to do (GRD-04 AC2)', async () => {
      plantOn([plantAt('clover-1', 0, 0, { water: 0.05 })]);

      await hover(plant('clover-1'));

      expect(statuses()[1]).toEqual({ icon: 'drop-empty', text: 'Thirsty — hold a cloud over it' });
    });

    it('shows a mushroom under the sun as a bit too sunny (GRD-03 AC3)', async () => {
      plantOn([plantAt('mushroom-1', 0, 0, { type: 'mushroom' })]);

      await hover(plant('mushroom-1'));

      expect(title()).toBe('Mushroom');
      expect(statuses()[2]).toEqual({ icon: 'sun', text: 'A bit too sunny — move the sun away' });
    });

    it('follows the sun: on the night side the clover is too dark', async () => {
      await hover(plant('clover-1'));

      TestBed.inject(SkyService).holdSun(180);
      await fixture.whenStable();

      expect(statuses()[2]).toEqual({
        icon: 'moon',
        text: 'A bit too dark — drag the sun over it',
      });
    });

    it('says when the seeds of a bloom are ready (GRD-08 AC1)', async () => {
      plantOn([plantAt('clover-1', 0, 0, { stage: 'bloom', harvestReady: true })]);

      await hover(plant('clover-1'));

      expect(statuses()[0]).toEqual({
        icon: 'sparkle',
        text: 'In bloom, seeds ready — tap it to collect them',
      });
    });

    it("shows a decoration's name", async () => {
      await hover(rock);

      expect(title()).toBe('Rock');
      expect(statuses()).toEqual([]);
    });

    it('closes when the pointer moves away, or on Escape', async () => {
      await hover(plant('clover-1'));
      await hover(null);
      expect(card()).toBeNull();

      await hover(plant('clover-1'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(card()).toBeNull();
    });

    it('gives way to a pinned card', async () => {
      await hover(rock);
      await pin(plant('clover-1'));

      expect(title()).toBe('Clover');
      expect(card()!.classList.contains('pinned')).toBe(true);
    });
  });

  describe('pinned', () => {
    it('offers Dig up for a plant, next to it, with the focus on it (GRD-07 AC1)', async () => {
      await pin(plant('clover-1'));

      expect(title()).toBe('Clover');
      expect(labels()).toEqual(['Dig up']);
      expect([card()!.style.left, card()!.style.top]).toEqual(['300px', '200px']);
      expect(document.activeElement).toBe(button('Dig up'));
    });

    it('digs the plant up and gives the focus back to the planet', async () => {
      await pin(plant('clover-1'));

      button('Dig up').click();
      await fixture.whenStable();

      http.expectOne({ method: 'DELETE', url: '/api/garden/plants/clover-1' });
      expect(card()).toBeNull();
      expect(focusCanvas).toHaveBeenCalled();
    });

    it('offers to collect the seeds of a ready bloom (GRD-08 AC2, SET-05)', async () => {
      plantOn([plantAt('clover-1', 0, 0, { stage: 'bloom', harvestReady: true })]);
      await pin(plant('clover-1'));

      expect(labels()).toEqual(['Collect seeds', 'Dig up']);
      expect(document.activeElement).toBe(button('Collect seeds'));
      button('Collect seeds').click();

      const request = http.expectOne({
        method: 'POST',
        url: '/api/garden/plants/clover-1/harvest',
      });
      expect(request.request.body).toEqual({ expectedVersion: 1 });
    });

    it('offers Move and Put away for a decoration (ITM-02 AC2, AC3)', async () => {
      await pin(rock);
      expect(title()).toBe('Rock');
      expect(labels()).toEqual(['Move', 'Put away']);

      button('Move').click();
      await fixture.whenStable();
      expect(placement.selected()).toEqual({
        mode: 'move',
        itemType: 'rock',
        decorationId: 'rock-1',
      });
      expect(card()).toBeNull();

      await pin(rock);
      button('Put away').click();
      http.expectOne({ method: 'DELETE', url: '/api/garden/decorations/rock-1' });
    });

    it('closes on Escape, giving the focus back to the planet', async () => {
      await pin(plant('clover-1'));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();

      expect(card()).toBeNull();
      expect(focusCanvas).toHaveBeenCalled();
    });

    it('closes on a press anywhere else, but not on itself', async () => {
      await pin(plant('clover-1'));

      card()!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();
      expect(card()).not.toBeNull();

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();
      expect(card()).toBeNull();
    });

    it('keeps clear of the edges of the view', async () => {
      await pin({ kind: 'plant', id: 'clover-1', x: 2, y: 590 });

      expect([card()!.style.left, card()!.style.top]).toEqual(['140px', '400px']);
    });
  });

  describe('digging up a plant a want needs (GRD-07 AC3)', () => {
    const wishing = (id: string, name: string) =>
      creatureAt(id, 20, 20, { name, want: CLOVER_WANT });

    /** The clover at 0, 0 and the pond the wants name, a step away or far off. */
    function garden(creatures: CreatureDto[], pondLon = 5) {
      TestBed.inject(PlanetStore).setSnapshot({
        ...MOSSY,
        plants: [plantAt('clover-1', 0, 0)],
        decorations: [{ id: 'pond-1', type: 'pond', lat: 0, lon: pondLon }],
        creatures,
      });
    }

    const warning = () => card()?.querySelector('[role="alert"]')?.textContent?.trim();

    it('names the creature first, and only digs it up after Confirm', async () => {
      garden([wishing('mira', 'Mira')]);
      await pin(plant('clover-1'));

      button('Dig up').click();
      await fixture.whenStable();

      http.expectNone({ method: 'DELETE', url: '/api/garden/plants/clover-1' });
      expect(warning()).toBe(
        "Mira will notice — this clover is part of Mira's wish. Dig it up anyway?",
      );
      expect(labels()).toEqual(['Confirm', 'Keep it']);
      expect(document.activeElement).toBe(button('Confirm'));

      button('Confirm').click();
      await fixture.whenStable();

      http.expectOne({ method: 'DELETE', url: '/api/garden/plants/clover-1' });
      expect(card()).toBeNull();
      expect(focusCanvas).toHaveBeenCalled();
    });

    it('keeps the plant on "Keep it"', async () => {
      garden([wishing('mira', 'Mira')]);
      await pin(plant('clover-1'));
      button('Dig up').click();
      await fixture.whenStable();

      button('Keep it').click();
      await fixture.whenStable();

      expect(warning()).toBeUndefined();
      expect(labels()).toEqual(['Dig up']);
      expect(document.activeElement).toBe(button('Dig up'));
      http.expectNone({ method: 'DELETE', url: '/api/garden/plants/clover-1' });
    });

    it('names every creature that would notice', async () => {
      garden([wishing('mira', 'Mira'), wishing('sam', 'Sam'), creatureAt('pip', 0, 0)]);
      await pin(plant('clover-1'));

      button('Dig up').click();
      await fixture.whenStable();

      expect(warning()).toBe(
        'Mira and Sam will notice — this clover is part of their wishes. Dig it up anyway?',
      );
    });

    it('digs up at once a plant no want needs', async () => {
      garden([wishing('mira', 'Mira')], 40);
      await pin(plant('clover-1'));

      button('Dig up').click();
      await fixture.whenStable();

      expect(warning()).toBeUndefined();
      http.expectOne({ method: 'DELETE', url: '/api/garden/plants/clover-1' });
    });
  });

  describe('a creature (NAV-03 AC2, CRT-03 AC1)', () => {
    const mira = creatureAt('mira', 5, 5);
    const sam = creatureAt('sam', 20, 40, {
      species: 'snail',
      name: 'Sam',
      backstory: 'Sam slid in after the rain.',
    });
    const creature = (id: string): CardTarget => ({ kind: 'creature', id, x: 300, y: 200 });

    const meet = (changes: Partial<CreatureDto> = {}) =>
      TestBed.inject(PlanetStore).setSnapshot({
        ...MOSSY,
        creatures: [{ ...mira, ...changes }, sam],
      });
    const text = () => card()!.textContent!;

    const quirk = () => card()!.querySelector('.quirk')?.textContent?.trim();

    it('shows its name, species, summary, quirk, and its mood and want as icon and words', async () => {
      meet();

      await hover(creature('mira'));

      expect(title()).toBe('Mira');
      expect(card()!.querySelector('.species')?.textContent?.trim()).toBe('Moth');
      expect(text()).toContain('A gentle night owl who hums to the moonflowers.');
      expect(quirk()).toBe('Quirk: Counts the stars out loud.');
      expect(statuses()).toEqual([
        { icon: 'content', text: 'Content' },
        { icon: 'wish', text: 'No wish right now' },
      ]);
      expect(card()!.getAttribute('aria-describedby')).toBe('creature-card-about');
      expect(labels()).toEqual([]);
      expect(text()).not.toContain(mira.backstory);
    });

    it('shows each mood, and a creature missing what it came for as "A bit wistful" (CRT-04)', async () => {
      meet({ mood: 'cheerful' });
      await hover(creature('mira'));
      expect(statuses()[0]).toEqual({ icon: 'cheerful', text: 'Cheerful' });

      meet({ mood: 'overjoyed' });
      await fixture.whenStable();
      expect(statuses()[0]).toEqual({ icon: 'overjoyed', text: 'Overjoyed' });

      meet({ wistful: true });
      await fixture.whenStable();
      expect(statuses()[0]).toEqual({ icon: 'wistful', text: 'A bit wistful' });
    });

    it('shows the quirk on the pinned card, with traits and backstory behind "More" (CRT-03 AC1)', async () => {
      meet();
      await pin(creature('mira'));

      expect(labels()).toEqual(['Chat', 'More']);
      expect(document.activeElement).toBe(button('Chat'));
      expect(button('More').getAttribute('aria-expanded')).toBe('false');
      expect(quirk()).toBe('Quirk: Counts the stars out loud.');
      expect(text()).not.toContain(mira.backstory);
      expect(text()).not.toContain('gentle, dreamy');

      button('More').click();
      await fixture.whenStable();

      expect(button('Less').getAttribute('aria-expanded')).toBe('true');
      const more = (tag: string) =>
        [...card()!.querySelectorAll(tag)].map((each) => each.textContent!.trim());
      expect(more('dt')).toEqual(['Personality', 'Story']);
      expect(more('dd')).toEqual(['gentle, dreamy', mira.backstory]);
      expect(quirk()).toBe('Quirk: Counts the stars out loud.');

      button('Less').click();
      await fixture.whenStable();
      expect(text()).not.toContain(mira.backstory);
    });

    it('shows its want in its own voice, with the plain description beneath (WNT-01 AC3, WNT-02 AC2)', async () => {
      meet({ want: CLOVER_WANT });

      await hover(creature('mira'));

      expect(card()!.querySelector('.voice')?.textContent?.trim()).toBe(CLOVER_WANT.text);
      expect(card()!.querySelector('.plain')?.textContent?.trim()).toBe(
        '3 clovers within 2 steps of the pond',
      );
      expect(statuses().map(({ icon }) => icon)).toEqual(['content', 'wish']);
      expect(text()).not.toContain('No wish right now');
      expect(labels()).toEqual([]);
    });

    it('sets the want aside on "Maybe later" with a friendly line, the mood unchanged (WNT-05 AC1, AC2)', async () => {
      meet({ want: CLOVER_WANT, mood: 'cheerful' });
      await pin(creature('mira'));
      expect(labels()).toEqual(['Chat', 'More', 'Maybe later']);
      expect(document.activeElement).toBe(button('Chat'));

      button('Maybe later').click();
      const request = http.expectOne({ method: 'POST', url: '/api/wants/want-1/maybe-later' });
      expect(request.request.body).toEqual({ expectedVersion: 1 });
      request.flush({
        snapshot: {
          ...MOSSY,
          version: 2,
          creatures: [{ ...mira, mood: 'cheerful', want: null }, sam],
        },
        events: [],
      });
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(card()!.querySelector('.note[role="status"]')?.textContent?.trim()).toBe(
        'No rush — Mira will think of something else.',
      );
      expect(statuses()).toEqual([
        { icon: 'cheerful', text: 'Cheerful' },
        { icon: 'wish', text: 'No wish right now' },
      ]);
      expect(labels()).toEqual(['Chat', 'More']);
      expect(document.activeElement).toBe(button('Chat'));
    });

    it('says why when "Maybe later" does not go through', async () => {
      meet({ want: CLOVER_WANT });
      await pin(creature('mira'));

      button('Maybe later').click();
      http
        .expectOne('/api/wants/want-1/maybe-later')
        .flush(
          { statusCode: 404, message: 'That wish has already changed.' },
          { status: 404, statusText: 'Not Found' },
        );
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(card()!.querySelector('.note')?.textContent?.trim()).toBe(
        'That wish has already changed.',
      );
      expect(labels()).toEqual(['Chat', 'More', 'Maybe later']);
    });

    it('keeps the story open when a heartbeat brings the same creature again', async () => {
      meet();
      await pin(creature('mira'));
      button('More').click();
      await fixture.whenStable();

      meet({ mood: 'cheerful' });
      await fixture.whenStable();

      expect(labels()).toEqual(['Chat', 'Less']);
      expect(text()).toContain(mira.backstory);
    });

    it("starts with the next creature's story closed", async () => {
      meet();
      await pin(creature('mira'));
      button('More').click();
      await fixture.whenStable();

      await pin(creature('sam'));

      expect(title()).toBe('Sam');
      expect(labels()).toEqual(['Chat', 'More']);
      expect(text()).not.toContain(sam.backstory);
    });

    it("opens the creature's chat from the pinned card (CHT-01 AC1)", async () => {
      meet();
      await pin(creature('mira'));

      button('Chat').click();

      expect(TestBed.inject(ChatService).creatureId()).toBe('mira');
    });
  });
});
