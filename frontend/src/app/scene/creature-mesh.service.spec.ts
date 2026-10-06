import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as THREE from 'three';
import type { MockInstance } from 'vitest';
import { WANDER_RADIUS_STEPS } from '../core/helpers/creature-wander';
import {
  STEP_ARC,
  SurfacePoint,
  fromVector,
  stepsBetween,
  toVector,
} from '../core/helpers/surface-coords';
import { CreatureDto } from '../core/models/creature';
import { PlanetStore } from '../core/services/planet-store.service';
import { SyncService } from '../core/services/sync.service';
import { FAKE_MOTION_PROVIDERS, FakeMotionPreference } from '../testing/fake-motion';
import { MOSSY, creatureAt, wantFulfilled } from '../testing/garden-fixtures';
import { seededRandom } from '../testing/seeded-random';
import {
  ARRIVAL_SECONDS,
  CHEER_SECONDS,
  CREATURE_TICK_MS,
  CreatureMeshService,
  HOVER_STEPS,
  dropLift,
} from './creature-mesh.service';
import { NullSceneRenderer } from './null-scene-renderer';
import { PickingService } from './picking.service';
import { PlanetMeshService } from './planet-mesh.service';
import { SCENE_RENDERER } from './scene-renderer';
import { SceneService } from './scene.service';
import { CLOUD_HEIGHT, SkyService } from './sky.service';

describe('CreatureMeshService', () => {
  let scene: SceneService;
  let store: PlanetStore;
  let picking: PickingService;
  /** The longitude the sun stands over; the real sky would also redraw every second. */
  let sunAngle: WritableSignal<number>;
  let onFrame: MockInstance<SceneService['onFrame']>;
  let requestRender: MockInstance<SceneService['requestRender']>;
  let version: number;

  /** A snail: it walks, so it stands right on its spot. */
  const sam = creatureAt('sam', 10, 20, { species: 'snail', name: 'Sam' });
  /** A moth: it flies, so it hovers over its spot while awake. */
  const mira = creatureAt('mira', -20, 30);

  beforeEach(() => {
    vi.useFakeTimers();
    // Over lon 25: daylight for Sam and Mira.
    sunAngle = signal(25);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SceneService,
        PickingService,
        PlanetMeshService,
        CreatureMeshService,
        FAKE_MOTION_PROVIDERS,
        { provide: SkyService, useValue: { sunAngle } },
        { provide: SCENE_RENDERER, useClass: NullSceneRenderer },
      ],
    });
    scene = TestBed.inject(SceneService);
    scene.resize(800, 600);
    store = TestBed.inject(PlanetStore);
    picking = TestBed.inject(PickingService);
    TestBed.inject(PlanetMeshService);
    version = 1;
  });

  afterEach(() => vi.useRealTimers());

  /** The service, made with the given settings before it sees a snapshot. */
  function start({ reducedMotion = false } = {}): CreatureMeshService {
    onFrame = vi.spyOn(scene, 'onFrame');
    TestBed.inject(FakeMotionPreference).reduced.set(reducedMotion);
    const service = TestBed.inject(CreatureMeshService);
    service.random = seededRandom(11);
    requestRender = vi.spyOn(scene, 'requestRender');
    return service;
  }

  const show = (creatures: CreatureDto[], id = MOSSY.id) => {
    store.setSnapshot({ ...MOSSY, id, version: version++, creatures });
    TestBed.tick();
  };

  /** Runs the scene's frame step for the arrivals. */
  const frame = (dt: number) => onFrame.mock.calls[0][0](dt);

  /** Where the creature's group stands: its surface point, and its height over the ground in steps. */
  const standing = (group: THREE.Group) => {
    const position = group.position.clone();
    return { point: fromVector(position), lift: (position.length() - 1) / STEP_ARC };
  };

  /** Turns the planet so the point faces the camera, then picks the middle of the view. */
  const pickAt = (point: SurfacePoint) => {
    const { x, y, z } = toVector(point, 1);
    scene.planetGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(0, 0, 1),
    );
    return picking.pick({ x: 400, y: 300 });
  };

  it('draws each creature at its home, pickable as itself (CRT-01)', () => {
    const creatures = start();

    show([sam, mira]);

    expect(creatures.creatures.map(({ id }) => id)).toEqual(['sam', 'mira']);
    const snail = creatures.creature('sam')!;
    expect(snail.group.parent).toBe(scene.planetGroup);
    expect(snail.body.name).toBe('snail');
    expect(standing(snail.group).point.lat).toBeCloseTo(10, 6);
    expect(standing(snail.group).point.lon).toBeCloseTo(20, 6);
    expect(standing(snail.group).lift).toBeCloseTo(0, 6);
    expect(standing(creatures.creature('mira')!.group).lift).toBeCloseTo(HOVER_STEPS, 6);
    expect(snail.arrival).toBeNull();

    expect(pickAt(sam)).toMatchObject({ kind: 'creature', id: 'sam' });
    expect(pickAt(mira)).toMatchObject({ kind: 'creature', id: 'mira' });
  });

  it('wanders near home a few times a second, sitting in between (NAV-04 AC1)', () => {
    const creatures = start();
    show([sam]);
    const snail = creatures.creature('sam')!;
    let moves = 0;
    let previous = snail.point;

    for (let tick = 0; tick < 480; tick++) {
      vi.advanceTimersByTime(CREATURE_TICK_MS);
      expect(stepsBetween(sam, snail.point)).toBeLessThanOrEqual(WANDER_RADIUS_STEPS + 1e-9);
      expect(stepsBetween(standing(snail.group).point, snail.point)).toBeLessThan(1e-6);
      moves += snail.point === previous ? 0 : 1;
      previous = snail.point;
    }

    // A minute: it walked part of the time and sat the rest.
    expect(moves).toBeGreaterThan(20);
    expect(moves).toBeLessThan(480);
    expect(requestRender.mock.calls.length).toBeGreaterThanOrEqual(moves);
    expect(requestRender.mock.calls.length).toBeLessThan(480);
  });

  it('naps on the night side, lower and under a "z", and wakes when the sun comes (NAV-04 AC2)', () => {
    const creatures = start();
    const night = creatureAt('nox', 0, -150, { species: 'hedgehog' });

    show([sam, night]);

    const hedgehog = creatures.creature('nox')!;
    expect(hedgehog.asleep).toBe(true);
    expect(hedgehog.body.scale.y).toBeLessThan(1);
    expect(hedgehog.nap.parent).toBe(hedgehog.group);
    expect(creatures.creature('sam')!.asleep).toBe(false);
    expect(creatures.creature('sam')!.nap.parent).toBeNull();

    // A sleeper does not wander.
    vi.advanceTimersByTime(30_000);
    expect(hedgehog.point).toEqual({ lat: 0, lon: -150 });

    sunAngle.set(-150);
    vi.advanceTimersByTime(CREATURE_TICK_MS);
    expect(hedgehog.asleep).toBe(false);
    expect(hedgehog.body.scale.y).toBe(1);
    expect(hedgehog.nap.parent).toBeNull();
    expect(creatures.creature('sam')!.asleep).toBe(true);
  });

  it('lets a flyer land to nap', () => {
    const creatures = start();
    show([creatureAt('mira', 0, 180)]);

    expect(standing(creatures.creature('mira')!.group).lift).toBeCloseTo(0, 6);
  });

  it('moves nothing with reduced motion (SET-03, NAV-04 AC3)', () => {
    const creatures = start({ reducedMotion: true });
    show([sam, mira]);
    const before = creatures.creatures.map(({ group }) => group.position.clone());
    requestRender.mockClear();

    vi.advanceTimersByTime(60_000);

    expect(creatures.creature('sam')!.point).toEqual({ lat: 10, lon: 20 });
    expect(creatures.creatures.map(({ group }) => group.position)).toEqual(before);
    expect(requestRender).not.toHaveBeenCalled();
  });

  it('stops wandering as soon as motion is reduced, and wanders again once it is not', () => {
    const creatures = start();
    show([sam]);
    const snail = creatures.creature('sam')!;
    vi.advanceTimersByTime(20_000);

    TestBed.inject(FakeMotionPreference).reduced.set(true);
    const stopped = snail.point;
    vi.advanceTimersByTime(60_000);
    expect(snail.point).toBe(stopped);

    TestBed.inject(FakeMotionPreference).reduced.set(false);
    vi.advanceTimersByTime(60_000);
    expect(snail.point).not.toBe(stopped);
  });

  describe('moving in (CRT-01 AC1)', () => {
    it('drops a new creature from the sky with a little bounce, once', () => {
      const creatures = start();
      show([]);

      show([sam]);

      const snail = creatures.creature('sam')!;
      expect(snail.arrival?.kind).toBe('drop');
      expect(standing(snail.group).lift).toBeCloseTo((CLOUD_HEIGHT - 1) / STEP_ARC, 6);
      expect(standing(snail.group).point.lat).toBeCloseTo(10, 6);

      // It waits for the drop before it wanders off.
      vi.advanceTimersByTime(10_000);
      expect(snail.point).toEqual({ lat: 10, lon: 20 });

      frame(0);
      frame(ARRIVAL_SECONDS * 0.7);
      expect(standing(snail.group).lift).toBeCloseTo(0, 6);
      frame(ARRIVAL_SECONDS * 0.15);
      expect(standing(snail.group).lift).toBeGreaterThan(0.1);
      expect(requestRender).toHaveBeenCalled();
      frame(ARRIVAL_SECONDS * 0.2);
      expect(snail.arrival).toBeNull();
      expect(standing(snail.group).lift).toBeCloseTo(0, 6);

      show([sam]);
      expect(snail.arrival).toBeNull();
    });

    it('does not drop the creatures that were there when the planet opened', () => {
      const creatures = start();

      show([sam]);
      expect(creatures.creature('sam')!.arrival).toBeNull();

      // Nor on opening another planet.
      show([mira], 'another-planet');
      expect(creatures.creatures.map(({ id }) => id)).toEqual(['mira']);
      expect(creatures.creature('mira')!.arrival).toBeNull();
    });

    it('fades a new creature in on its spot with reduced motion (SET-03)', () => {
      const creatures = start({ reducedMotion: true });
      show([]);

      show([sam]);

      const snail = creatures.creature('sam')!;
      expect(snail.arrival?.kind).toBe('fade');
      expect(standing(snail.group).lift).toBeCloseTo(0, 6);
      expect(snail.body.material.transparent).toBe(true);
      expect(snail.body.material.opacity).toBe(0);

      frame(ARRIVAL_SECONDS / 2);
      expect(standing(snail.group).lift).toBeCloseTo(0, 6);
      expect(snail.body.material.opacity).toBeCloseTo(0.5, 6);

      frame(ARRIVAL_SECONDS);
      expect(snail.arrival).toBeNull();
      expect(snail.body.material.transparent).toBe(false);
      expect(snail.body.material.opacity).toBe(1);
    });
  });

  describe('cheering a fulfilled want (CRT-04 AC1)', () => {
    /** A heartbeat whose response says the creature's want was fulfilled. */
    const fulfil = (creature: CreatureDto) => {
      TestBed.inject(SyncService).syncNow();
      TestBed.inject(HttpTestingController)
        .expectOne('/api/planet/sync')
        .flush({ snapshot: store.snapshot(), events: [wantFulfilled(creature)] });
      TestBed.tick();
    };

    it('hops twice under rising sparkles, then stands as before', () => {
      const creatures = start();
      show([sam, mira]);
      const snail = creatures.creature('sam')!;

      fulfil(sam);

      expect(snail.cheer).toEqual({ kind: 'hop', elapsed: 0 });
      expect(snail.sparkles.parent).toBe(snail.group);
      expect(creatures.creature('mira')!.cheer).toBeNull();
      expect(requestRender).toHaveBeenCalled();

      // The top of the first hop, then back on the ground between the two.
      frame(CHEER_SECONDS / 4);
      expect(standing(snail.group).lift).toBeGreaterThan(0.2);
      const risen = snail.sparkles.position.y;
      expect(risen).toBeGreaterThan(0);
      frame(CHEER_SECONDS / 4);
      expect(standing(snail.group).lift).toBeCloseTo(0, 6);
      expect(snail.sparkles.position.y).toBeGreaterThan(risen);

      frame(CHEER_SECONDS / 2);
      expect(snail.cheer).toBeNull();
      expect(standing(snail.group).lift).toBeCloseTo(0, 6);
      expect(snail.sparkles.parent).toBeNull();
    });

    it('glows and fades instead of hopping with reduced motion, its sparkles still (SET-03)', () => {
      const creatures = start({ reducedMotion: true });
      show([sam]);
      const snail = creatures.creature('sam')!;

      fulfil(sam);

      expect(snail.cheer?.kind).toBe('glow');
      const glow = snail.body.material.emissive;
      const bright = glow.r;
      expect(bright).toBeGreaterThan(0);

      frame(CHEER_SECONDS / 4);
      expect(standing(snail.group).lift).toBeCloseTo(0, 6);
      expect(glow.r).toBeLessThan(bright);
      expect(snail.sparkles.parent).toBe(snail.group);
      expect(snail.sparkles.position.y).toBe(0);

      frame(CHEER_SECONDS);
      expect(snail.cheer).toBeNull();
      expect([glow.r, glow.g, glow.b]).toEqual([0, 0, 0]);
      expect(snail.sparkles.parent).toBeNull();
    });
  });

  it('takes away a creature the snapshot no longer has', () => {
    const creatures = start();
    show([sam, mira]);
    const snail = creatures.creature('sam')!;

    show([mira]);

    expect(creatures.creatures.map(({ id }) => id)).toEqual(['mira']);
    expect(snail.group.parent).toBeNull();
    expect(pickAt(sam)?.kind).not.toBe('creature');
  });
});

describe('dropLift', () => {
  it('falls from the sky to the ground, bounces once, and stays down', () => {
    const top = (CLOUD_HEIGHT - 1) / STEP_ARC;
    expect(dropLift(0)).toBeCloseTo(top, 9);
    expect(dropLift(0.35)).toBeLessThan(top);
    expect(dropLift(0.6)).toBeLessThan(dropLift(0.35));
    expect(dropLift(0.7)).toBeCloseTo(0, 9);
    expect(dropLift(0.85)).toBeGreaterThan(0);
    expect(dropLift(0.85)).toBeLessThan(1);
    expect(dropLift(1)).toBe(0);
  });
});
