import { DestroyRef, Injectable, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as THREE from 'three';
import { along, wanderStep } from '../core/helpers/creature-wander';
import { prefersReducedMotion } from '../core/helpers/reduced-motion';
import { lightAt } from '../core/helpers/sun-model';
import { STEP_ARC, SurfacePoint, stepsBetween, toVector } from '../core/helpers/surface-coords';
import { CreatureDto } from '../core/models/creature';
import { PlanetSnapshotDto } from '../core/models/planet-snapshot';
import { WantFulfilledPayload } from '../core/models/want';
import { PlanetStore } from '../core/services/planet-store.service';
import { SyncService } from '../core/services/sync.service';
import { FLYING_SPECIES, creatureModel, napTexture } from './creature-models';
import { sparkleModel } from './garden-models';
import { spinOf, standOn } from './low-poly';
import { PickingService } from './picking.service';
import { planetRadius } from './planet-mesh.service';
import { SceneService } from './scene.service';
import { CLOUD_HEIGHT, SkyService } from './sky.service';
import { SPARKLE_COLOUR } from './sparkles';

/** How often the creatures move on: often enough to look alive, far less than every frame. */
export const CREATURE_TICK_MS = 125;
/** With less light than this on its spot, a creature naps (NAV-04 AC2). */
export const NAP_LIGHT = 0.1;
/** How fast a creature walks, in steps per second. */
export const WALK_STEPS_PER_SECOND = 0.3;
/** How long an arrival takes, in seconds (CRT-01 AC1). */
export const ARRIVAL_SECONDS = 1;
/** How high a flyer hovers while awake, in steps. */
export const HOVER_STEPS = 0.45;
/** How long a creature sits between walks, in seconds. */
const SIT_SECONDS = { min: 2, max: 6 };
/** How far a hovering flyer bobs up and down, in steps, and how long one bob takes. */
const BOB_STEPS = 0.06;
const BOB_SECONDS = 2.4;
/** The share of an arrival spent falling; the rest is one little bounce, this many steps high. */
const FALL_SHARE = 0.7;
const BOUNCE_STEPS = 0.5;
/** A napping creature lies lower and a little wider, under a "z" this many steps tall. */
const NAP_SQUASH = new THREE.Vector3(1.12, 0.65, 1.12);
const NAP_SIZE = 0.5;
/** How long a creature's happy reaction to a fulfilled want takes, in seconds (CRT-04 AC1). */
export const CHEER_SECONDS = 1.2;
/** How high each of its two little hops goes, in steps. */
const HOP_STEPS = 0.35;
/** How far its sparkles rise, in steps; with reduced motion they stand still. */
const SPARKLE_RISE_STEPS = 0.5;
/** Where each sparkle sits over the top of the creature, in steps. */
const SPARKLE_SPOTS: [number, number, number][] = [
  [0.3, 0.1, 0],
  [-0.25, 0.25, 0.1],
  [0.05, 0.4, -0.2],
];
/** The warm glow it brightens with instead of hopping when motion is reduced. */
const GLOW = new THREE.Color('#ffd76a');

const UP = new THREE.Vector3(0, 1, 0);
const AWAKE = new THREE.Vector3(1, 1, 1);

/** A creature as it is drawn now. */
export interface DrawnCreature {
  readonly id: string;
  /** Stands the creature on the planet; pickable as the creature. */
  readonly group: THREE.Group;
  /** Its model, lower while it naps. */
  readonly body: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  /** The "z" over it, in the group only while it naps. */
  readonly nap: THREE.Sprite;
  readonly home: SurfacePoint;
  /** Where it is now. */
  readonly point: SurfacePoint;
  readonly asleep: boolean;
  /** How it is moving in, and for how long so far in seconds; null once it is down. */
  readonly arrival: { readonly kind: 'drop' | 'fade'; readonly elapsed: number } | null;
  /** The sparkles over it, in the group only while it cheers. */
  readonly sparkles: THREE.Group;
  /** How it cheers a fulfilled want, and for how long so far in seconds; null otherwise. */
  readonly cheer: { readonly kind: 'hop' | 'glow'; readonly elapsed: number } | null;
}

interface Creature extends DrawnCreature {
  home: SurfacePoint;
  point: SurfacePoint;
  asleep: boolean;
  arrival: { kind: 'drop' | 'fade'; elapsed: number } | null;
  cheer: { kind: 'hop' | 'glow'; elapsed: number } | null;
  flies: boolean;
  /** Radians about its up axis; 0 faces the way standOn() turns 0 to. */
  heading: number;
  /** The walk it is on, in steps; null while it sits. */
  walk: { from: SurfacePoint; to: SurfacePoint; walked: number; length: number } | null;
  sitLeft: number;
}

/**
 * How far above its spot an arriving creature is, in steps, at a share t of its arrival: it
 * falls from the sky the clouds float in, then bounces once.
 */
export function dropLift(t: number): number {
  if (t >= 1) {
    return 0;
  }
  if (t < FALL_SHARE) {
    const fallen = t / FALL_SHARE;
    return ((CLOUD_HEIGHT - 1) / STEP_ARC) * (1 - fallen * fallen);
  }
  const bounced = (t - FALL_SHARE) / (1 - FALL_SHARE);
  return BOUNCE_STEPS * 4 * bounced * (1 - bounced);
}

/**
 * The creatures on the planet (CRT-01, NAV-04), drawn from the snapshot: one low-poly model
 * per creature on its home spot, pickable as a 'creature' with its id. A few times a second
 * each one moves on: it sits a while, then walks to another spot near home (flyers hover
 * as they go), and on the night side it naps, lower and under a little "z". A creature that
 * was not in the previous snapshot of the planet moves in: it drops from the sky with a little
 * bounce, or fades in when motion is reduced, and with reduced motion nothing wanders either
 * (SET-03). The creatures there when the planet opens are simply there. A creature whose want
 * is fulfilled cheers (CRT-04 AC1): two little hops under rising sparkles, or with reduced
 * motion a warm glow that fades under sparkles that stand still.
 */
@Injectable()
export class CreatureMeshService {
  private readonly scene = inject(SceneService);
  private readonly picking = inject(PickingService);
  private readonly sky = inject(SkyService);

  /** Read once at start; the settings take this over later (SET-03). */
  reducedMotion = prefersReducedMotion();
  /** Where the wandering takes its chances from. */
  random: () => number = Math.random;

  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly napMaterial = new THREE.SpriteMaterial({
    map: napTexture(),
    transparent: true,
    depthWrite: false,
  });
  private readonly sparkleGeometry = sparkleModel();
  private readonly sparkleMaterial = new THREE.MeshBasicMaterial({ color: SPARKLE_COLOUR });
  private readonly drawn = new Map<string, Creature>();
  private planetId: string | null = null;
  private radius = planetRadius(1);
  /** Time the creatures have moved on for, in seconds; it sets the bob of the flyers. */
  private seconds = 0;

  constructor() {
    const store = inject(PlanetStore);
    effect(() => {
      const snapshot = store.snapshot();
      untracked(() => this.draw(snapshot));
    });
    const timer = setInterval(() => this.tick(CREATURE_TICK_MS / 1000), CREATURE_TICK_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.napMaterial.map?.dispose();
    });
    this.scene.onFrame((dt) => this.animate(dt));
    inject(SyncService)
      .events.pipe(takeUntilDestroyed())
      .subscribe((events) => {
        for (const { type, payload } of events) {
          if (type === 'want-fulfilled') {
            this.cheer((payload as unknown as WantFulfilledPayload).creatureId);
          }
        }
      });
  }

  /** Every creature as drawn now, in the snapshot's order. */
  get creatures(): readonly DrawnCreature[] {
    return [...this.drawn.values()];
  }

  creature(id: string): DrawnCreature | undefined {
    return this.drawn.get(id);
  }

  /** Starts the creature's happy reaction to a fulfilled want (CRT-04 AC1). */
  cheer(id: string): void {
    const creature = this.drawn.get(id);
    if (!creature) {
      return;
    }
    const kind = this.reducedMotion ? 'glow' : 'hop';
    creature.cheer = { kind, elapsed: 0 };
    if (kind === 'glow') {
      creature.body.material.emissive.copy(GLOW);
    }
    this.pose(creature);
    this.scene.requestRender();
  }

  /**
   * Moves every creature on by the seconds: it naps or wakes with the light on its spot, and
   * an awake one sits or wanders, unless motion is reduced. Runs every CREATURE_TICK_MS, and
   * draws only when something changed.
   */
  tick(seconds: number): void {
    this.seconds += seconds;
    let changed = this.napOrWake();
    if (!this.reducedMotion) {
      for (const creature of this.drawn.values()) {
        if (!creature.asleep && !creature.arrival) {
          // A hovering flyer bobs all the time.
          changed = this.wander(creature, seconds) || creature.flies || changed;
        }
      }
    }
    if (changed) {
      this.drawn.forEach((creature) => this.pose(creature));
      this.scene.requestRender();
    }
  }

  private draw(snapshot: PlanetSnapshotDto | null): void {
    // The first snapshot of a planet is where it starts: nobody moves in.
    const opened = (snapshot?.id ?? null) !== this.planetId;
    for (const creature of this.drawn.values()) {
      if (opened || !snapshot?.creatures.some(({ id }) => id === creature.id)) {
        this.remove(creature);
      }
    }
    this.planetId = snapshot?.id ?? null;
    if (snapshot) {
      this.radius = planetRadius(snapshot.radiusLevel);
      for (const creature of snapshot.creatures) {
        const drawn = this.drawn.get(creature.id);
        if (drawn) {
          drawn.home = { lat: creature.lat, lon: creature.lon };
        } else {
          this.add(creature, !opened);
        }
      }
    }
    this.napOrWake();
    this.drawn.forEach((creature) => this.pose(creature));
    this.scene.requestRender();
  }

  private add({ id, species, lat, lon }: CreatureDto, arriving: boolean): void {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const geometry = this.geometry(species);
    const body = new THREE.Mesh(geometry, material);
    body.name = species;
    const nap = new THREE.Sprite(this.napMaterial);
    nap.name = 'nap';
    nap.scale.setScalar(NAP_SIZE);
    nap.position.set(0.15, geometry.boundingBox!.max.y + NAP_SIZE * 0.6, 0);
    const sparkles = new THREE.Group();
    sparkles.name = 'sparkles';
    for (const [x, y, z] of SPARKLE_SPOTS) {
      const sparkle = new THREE.Mesh(this.sparkleGeometry, this.sparkleMaterial);
      sparkle.position.set(x, geometry.boundingBox!.max.y + y, z);
      sparkles.add(sparkle);
    }
    const group = new THREE.Group();
    group.name = id;
    group.add(body);
    this.scene.planetGroup.add(group);
    this.picking.register(group, { kind: 'creature', id });
    const kind = this.reducedMotion ? 'fade' : 'drop';
    if (arriving && kind === 'fade') {
      material.transparent = true;
      material.opacity = 0;
    }
    const home = { lat, lon };
    this.drawn.set(id, {
      id,
      group,
      body,
      nap,
      sparkles,
      home,
      point: home,
      asleep: false,
      arrival: arriving ? { kind, elapsed: 0 } : null,
      cheer: null,
      flies: FLYING_SPECIES.has(species),
      heading: spinOf(id),
      walk: null,
      sitLeft: this.sitSeconds(),
    });
  }

  private remove(creature: Creature): void {
    creature.group.removeFromParent();
    this.picking.unregister(creature.group);
    creature.body.material.dispose();
    this.drawn.delete(creature.id);
  }

  /** Puts each creature that is down to sleep, or wakes it, by the light on its spot. */
  private napOrWake(): boolean {
    const sunAngle = this.sky.sunAngle();
    let changed = false;
    for (const creature of this.drawn.values()) {
      const asleep = !creature.arrival && lightAt(creature.point, sunAngle) < NAP_LIGHT;
      changed ||= asleep !== creature.asleep;
      creature.asleep = asleep;
    }
    return changed;
  }

  /** Sits on, sets off for another spot near home, or walks on; true when it moved or turned. */
  private wander(creature: Creature, seconds: number): boolean {
    const walk = creature.walk;
    if (!walk) {
      creature.sitLeft -= seconds;
      if (creature.sitLeft > 0) {
        return false;
      }
      const to = wanderStep(creature.home, creature.point, this.random);
      creature.walk = {
        from: creature.point,
        to,
        walked: 0,
        length: stepsBetween(creature.point, to),
      };
      creature.heading = headingOf(creature.point, to) ?? creature.heading;
      return true;
    }
    walk.walked += WALK_STEPS_PER_SECOND * seconds;
    if (walk.walked >= walk.length) {
      creature.point = walk.to;
      creature.walk = null;
      creature.sitLeft = this.sitSeconds();
    } else {
      creature.point = along(walk.from, walk.to, walk.walked / walk.length);
    }
    return true;
  }

  /** Moves the arriving and cheering creatures on, every frame until each is done. */
  private animate(dt: number): void {
    const arriving = this.arrive(dt);
    const cheering = this.cheerOn(dt);
    if (arriving || cheering) {
      // Keeps drawing while anyone moves in or cheers; the loop rests once all are done.
      this.scene.requestRender();
    }
  }

  /** Moves the arriving creatures on; true while any is still on its way. */
  private arrive(dt: number): boolean {
    let arriving = false;
    for (const creature of this.drawn.values()) {
      const arrival = creature.arrival;
      if (!arrival) {
        continue;
      }
      arriving = true;
      arrival.elapsed += dt;
      if (arrival.elapsed >= ARRIVAL_SECONDS) {
        creature.arrival = null;
        creature.body.material.transparent = false;
        creature.body.material.opacity = 1;
        creature.body.material.needsUpdate = true;
      } else if (arrival.kind === 'fade') {
        creature.body.material.opacity = arrival.elapsed / ARRIVAL_SECONDS;
      }
      this.pose(creature);
    }
    return arriving;
  }

  /** Moves the cheering creatures on; true while any is still cheering. */
  private cheerOn(dt: number): boolean {
    let cheering = false;
    for (const creature of this.drawn.values()) {
      const cheer = creature.cheer;
      if (!cheer) {
        continue;
      }
      cheering = true;
      cheer.elapsed += dt;
      const glow = creature.body.material.emissive;
      if (cheer.elapsed >= CHEER_SECONDS) {
        creature.cheer = null;
        glow.setRGB(0, 0, 0);
      } else if (cheer.kind === 'glow') {
        glow.copy(GLOW).multiplyScalar(1 - cheer.elapsed / CHEER_SECONDS);
      }
      this.pose(creature);
    }
    return cheering;
  }

  /** Stands the creature where it is now, napping, hovering, cheering or on its way down. */
  private pose(creature: Creature): void {
    const { arrival, asleep, flies, cheer } = creature;
    let lift = arrival?.kind === 'drop' ? dropLift(arrival.elapsed / ARRIVAL_SECONDS) : 0;
    if (flies && !asleep) {
      const bob = this.reducedMotion ? 0 : Math.sin((this.seconds / BOB_SECONDS) * 2 * Math.PI);
      lift += HOVER_STEPS + BOB_STEPS * bob;
    }
    if (cheer) {
      const t = cheer.elapsed / CHEER_SECONDS;
      // Two hops, each a little arc.
      const hop = (t * 2) % 1;
      lift += cheer.kind === 'hop' ? HOP_STEPS * 4 * hop * (1 - hop) : 0;
      creature.sparkles.position.y = cheer.kind === 'hop' ? SPARKLE_RISE_STEPS * t : 0;
      creature.group.add(creature.sparkles);
    } else {
      creature.sparkles.removeFromParent();
    }
    standOn(creature.point, this.radius, creature.heading)
      .multiply(new THREE.Matrix4().makeTranslation(0, lift, 0))
      .decompose(creature.group.position, creature.group.quaternion, creature.group.scale);
    creature.body.scale.copy(asleep ? NAP_SQUASH : AWAKE);
    if (asleep) {
      creature.group.add(creature.nap);
    } else {
      creature.nap.removeFromParent();
    }
  }

  private sitSeconds(): number {
    return SIT_SECONDS.min + this.random() * (SIT_SECONDS.max - SIT_SECONDS.min);
  }

  private geometry(species: string): THREE.BufferGeometry {
    let geometry = this.geometries.get(species);
    if (!geometry) {
      geometry = creatureModel(species);
      geometry.computeBoundingBox();
      this.geometries.set(species, geometry);
    }
    return geometry;
  }
}

/**
 * The turn about its up axis that faces a creature standing on from towards to, as standOn()
 * takes it; null when the two are too close to tell.
 */
function headingOf(from: SurfacePoint, to: SurfacePoint): number | null {
  const at = vector(from);
  const way = vector(to).sub(at);
  if (way.lengthSq() < 1e-18) {
    return null;
  }
  const upright = new THREE.Quaternion().setFromUnitVectors(UP, at);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(upright);
  const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(upright);
  return Math.atan2(way.dot(right), way.dot(ahead));
}

function vector(point: SurfacePoint): THREE.Vector3 {
  const { x, y, z } = toVector(point, 1);
  return new THREE.Vector3(x, y, z);
}
