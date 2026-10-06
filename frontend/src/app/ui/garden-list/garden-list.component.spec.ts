import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { MockInstance } from 'vitest';
import * as THREE from 'three';
import { SurfacePoint, toVector } from '../../core/helpers/surface-coords';
import { CatalogueService } from '../../core/services/catalogue.service';
import { PlacementService } from '../../core/services/placement.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { CameraControlsService } from '../../scene/camera-controls.service';
import { NullSceneRenderer } from '../../scene/null-scene-renderer';
import { SCENE_RENDERER } from '../../scene/scene-renderer';
import { SCENE_PROVIDERS } from '../../scene/scene.providers';
import { SceneService } from '../../scene/scene.service';
import { SelectionRingService } from '../../scene/selection-ring.service';
import { axeViolations } from '../../testing/axe';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../../testing/fake-motion';
import { CATALOGUE, MOSSY, creatureAt, plantAt } from '../../testing/garden-fixtures';
import { GardenListComponent } from './garden-list.component';

const SUNFLOWER = { lat: 0, lon: 30 };
const POND = { lat: 20, lon: -30 };

describe('GardenListComponent', () => {
  let fixture: ComponentFixture<GardenListComponent>;
  let list: HTMLElement;
  let store: PlanetStore;
  let ring: SelectionRingService;
  let focusOn: MockInstance<CameraControlsService['focusOn']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GardenListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SCENE_PROVIDERS,
        PlacementService,
        FAKE_MOTION_PROVIDERS,
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    store = TestBed.inject(PlanetStore);
    store.setSnapshot({
      ...MOSSY,
      creatures: [creatureAt('mira', 10, 20, { mood: 'cheerful' })],
      plants: [
        plantAt('sunflower-1', SUNFLOWER.lat, SUNFLOWER.lon, {
          type: 'sunflower',
          stage: 'bloom',
          water: 0.05,
        }),
        plantAt('clover-1', -10, 40),
      ],
      decorations: [{ id: 'pond-1', type: 'pond', ...POND }],
    });
    TestBed.inject(CatalogueService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/catalogue').flush(CATALOGUE);
    TestBed.inject(SceneService).resize(800, 600);
    ring = TestBed.inject(SelectionRingService);
    focusOn = vi.spyOn(TestBed.inject(CameraControlsService), 'focusOn');
    fixture = TestBed.createComponent(GardenListComponent);
    list = fixture.nativeElement;
    fixture.detectChanges();
  });

  const options = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  /** What each option is called, as a screen reader would work it out from its words. */
  const labels = () => options().map((option) => option.textContent!.replace(/\s+/g, ' ').trim());
  const tabIndexes = () => options().map((option) => option.tabIndex);
  const announced = () => list.querySelector('[aria-live]')!.textContent;
  const focus = (option: HTMLElement) => {
    option.focus();
    fixture.detectChanges();
  };
  const press = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  it('lists the creatures, plants and decorations, each with its state in words (SET-05)', () => {
    expect(list.querySelector('[role="listbox"]')).not.toBeNull();
    expect(labels()).toEqual([
      'Mira the moth, cheerful',
      'Sunflower, in bloom, thirsty',
      'Clover, seed, happy',
      'Pond',
    ]);
    expect(options().every((option) => !option.hasAttribute('aria-label'))).toBe(true);
  });

  it('is one Tab stop, and arrows, Home and End move the focus between the options', () => {
    expect(tabIndexes()).toEqual([0, -1, -1, -1]);

    focus(options()[0]);
    expect(press('ArrowDown').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(options()[1]);
    expect(tabIndexes()).toEqual([-1, 0, -1, -1]);

    press('ArrowRight');
    expect(document.activeElement).toBe(options()[2]);
    press('End');
    expect(document.activeElement).toBe(options()[3]);
    press('ArrowDown');
    expect(document.activeElement).toBe(options()[3]);
    press('ArrowUp');
    expect(document.activeElement).toBe(options()[2]);
    press('Home');
    expect(document.activeElement).toBe(options()[0]);
    press('ArrowLeft');
    expect(document.activeElement).toBe(options()[0]);
  });

  it('keeps the option last moved to as the Tab stop', () => {
    focus(options()[0]);
    press('End');
    options()[3].blur();
    fixture.detectChanges();

    expect(tabIndexes()).toEqual([-1, -1, -1, 0]);
  });

  it('rings the option moved to, turns the planet to it and says it (AC2)', () => {
    focus(options()[1]);

    expect(ring.selected).toEqual({ kind: 'plant', id: 'sunflower-1' });
    expect(ring.ring.visible).toBe(true);
    expect(focusOn).toHaveBeenLastCalledWith(SUNFLOWER);
    expect(announced()).toBe('Sunflower, in bloom, thirsty');
    expect(options()[1].classList).toContain('selected');
    expect(options()[1].getAttribute('aria-selected')).toBe('true');

    press('ArrowDown');
    expect(ring.selected).toEqual({ kind: 'plant', id: 'clover-1' });
    expect(announced()).toBe('Clover, seed, happy');

    options()[2].blur();
    fixture.detectChanges();
    expect(ring.selected).toBeNull();
    expect(list.querySelector('.selected')).toBeNull();
  });

  it('jumps the planet round instead of swooping when motion is reduced (SET-03)', () => {
    TestBed.inject(FakeMotionPreference).reduced.set(true);
    focusOn.mockRestore();

    focus(options()[3]);

    const { x, y, z } = toVector(POND as SurfacePoint, 1);
    const facing = new THREE.Vector3(x, y, z).applyQuaternion(
      TestBed.inject(SceneService).planetGroup.quaternion,
    );
    expect(facing.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-6);
  });

  it("opens a creature's card on Enter, at the middle of the view, as a tap does (CHT-01 AC1)", () => {
    const placement = TestBed.inject(PlacementService);
    focus(options()[0]);

    expect(press('Enter').defaultPrevented).toBe(true);

    expect(placement.card()).toEqual({ kind: 'creature', id: 'mira', x: 400, y: 300 });
  });

  it("opens a plant's card on Space", () => {
    const placement = TestBed.inject(PlacementService);
    focus(options()[1]);

    expect(press(' ').defaultPrevented).toBe(true);

    expect(placement.card()).toEqual({ kind: 'plant', id: 'sunflower-1', x: 400, y: 300 });
  });

  it('goes back to the canvas on Escape', () => {
    const focusCanvas = vi.spyOn(TestBed.inject(SceneService), 'focusCanvas');
    focus(options()[0]);

    press('Escape');

    expect(focusCanvas).toHaveBeenCalled();
  });

  it('passes the WCAG 2.1 AA rules, folded away and with an option picked (NFR-05)', async () => {
    expect(await axeViolations(list)).toEqual([]);

    focus(options()[1]);
    expect(await axeViolations(list)).toEqual([]);
  });

  it('says so when there is nothing on the planet, with no Tab stop', () => {
    store.setSnapshot(MOSSY);
    fixture.detectChanges();

    expect(list.querySelector('[role="listbox"]')).toBeNull();
    expect(list.querySelector('.hint')?.textContent).toContain('Nothing growing here yet');
  });
});
