import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import * as THREE from 'three';
import { CloudTunables, cloudAt } from '../core/helpers/cloud-rules';
import { SunOverride, sunAngleAt } from '../core/helpers/sun-model';
import { STEP_ARC, SurfacePoint, toVector } from '../core/helpers/surface-coords';
import { GameConfig } from '../core/models/game-config';
import { SunStateDto } from '../core/models/planet-snapshot';
import { GameConfigService } from '../core/services/game-config.service';
import { MotionPreferenceService } from '../core/services/motion-preference.service';
import { PlanetStore } from '../core/services/planet-store.service';
import { PickingService } from './picking.service';
import { planetRadius } from './planet-mesh.service';
import { RAIN_COLOUR, RainStreaks } from './rain-streaks';
import { SceneService } from './scene.service';
import { cloudModel, sunModel } from './sky-models';

/** How high the clouds float and how far out the sun stands, as multiples of the planet radius. */
export const CLOUD_HEIGHT = 1.5;
export const SUN_DISTANCE = 2.2;
/** How often the clouds and the sun move on. They drift slowly, so once a second is enough. */
export const SKY_UPDATE_MS = 1000;
/** The outline around the selected cloud or sun (SET-05 AC2), in the focus ring's colour. */
export const OUTLINE_COLOUR = '#0b5cad';
const OUTLINE_SCALE = 1.25;
/** A cloud's size and opacity when empty and when full (GRD-02 AC2). */
const EMPTY_LOOK = { size: 0.55, opacity: 0.4 };
const FULL_LOOK = { size: 1, opacity: 0.95 };
/** The rain column's width, as a share of the rain's reach. */
const RAIN_SPREAD = 0.8;
/** The wet patch lies just above the faceted ground, so no facet pokes through it. */
const WET_HEIGHT = 1.003;

const UP = new THREE.Vector3(0, 1, 0);

/** A cloud as it is now. */
export interface SkyCloud {
  id: string;
  /** "Cloud 1" and so on, in the snapshot's order. */
  name: string;
  lat: number;
  lon: number;
  /** 0 (empty) to 1 (full). */
  water: number;
}

/** Something in the sky: a cloud by its id, or the sun. */
export type SkyTarget = { kind: 'cloud'; id: string } | { kind: 'sun' };

/** How big and how solid a cloud with this much water looks: smaller and paler as it empties. */
export function cloudLook(water: number): { size: number; opacity: number } {
  const full = THREE.MathUtils.clamp(water, 0, 1);
  return {
    size: THREE.MathUtils.lerp(EMPTY_LOOK.size, FULL_LOOK.size, full),
    opacity: THREE.MathUtils.lerp(EMPTY_LOOK.opacity, FULL_LOOK.opacity, full),
  };
}

/** The cloud rules' tunables, from the game config. */
export function cloudTunables(config: GameConfig): CloudTunables {
  return {
    driftDegreesPerMinute: config.cloudDriftDegreesPerMinute,
    refillSeconds: config.cloudRefillSeconds,
    rainSeconds: config.rainSeconds,
  };
}

interface CloudMesh {
  mesh: THREE.Mesh;
  material: THREE.MeshLambertMaterial;
  rain: RainStreaks | null;
  wet: THREE.Mesh | null;
}

/**
 * The clouds and the sun (GRD-02, GRD-03). The snapshot says where each was at serverTime;
 * from there they drift on by the same rules as on the server, moved on once a second. Clouds
 * float low over their surface points, smaller and paler as they run dry; the sun stands
 * further out over the equator, and the sun light shines from it, so the lit half follows it.
 * A raining cloud shows a wet patch where its rain lands, and falling streaks unless motion is
 * reduced. Clouds and sun turn with the planet and are pickable ('cloud' with its id, 'sun').
 * A cloud or the sun the player holds stays where it is put, whatever the snapshot says, until
 * let go.
 */
@Injectable()
export class SkyService {
  private readonly scene = inject(SceneService);
  private readonly picking = inject(PickingService);
  private readonly store = inject(PlanetStore);
  private readonly config = inject(GameConfigService).config;
  private readonly motion = inject(MotionPreferenceService);

  /** Everything in the sky, inside the planet group. */
  readonly group = new THREE.Group();
  readonly sun = new THREE.Mesh(sunModel(), new THREE.MeshBasicMaterial({ vertexColors: true }));

  private readonly cloudList = signal<SkyCloud[]>([]);
  private readonly angle = signal(0);
  /** Every cloud as it is now, in the snapshot's order. */
  readonly clouds = this.cloudList.asReadonly();
  /** The longitude the sun stands over now, in degrees. */
  readonly sunAngle = this.angle.asReadonly();

  private readonly cloudGeometry = cloudModel();
  /** A disc of radius 1 lying flat, for the wet patch under a raining cloud. */
  private readonly wetGeometry = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  private readonly wetMaterial = new THREE.MeshBasicMaterial({
    color: RAIN_COLOUR,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  private readonly cloudMeshes = new Map<string, CloudMesh>();
  private readonly outline = new THREE.Mesh(
    undefined,
    new THREE.MeshBasicMaterial({ color: OUTLINE_COLOUR, side: THREE.BackSide }),
  );
  private readonly held = new Map<string, SurfacePoint>();
  private heldSun: number | null = null;
  private readonly raining = new Set<string>();
  private selected: SkyTarget | null = null;
  /** The server's clock minus this device's, as of the last snapshot. */
  private clockOffset = 0;
  private rainTime = 0;

  constructor() {
    this.group.name = 'sky';
    this.sun.name = 'sun';
    this.outline.name = 'outline';
    this.outline.scale.setScalar(OUTLINE_SCALE);
    this.group.add(this.sun);
    this.scene.planetGroup.add(this.group);
    this.picking.register(this.sun, { kind: 'sun' });

    effect(() => {
      const snapshot = this.store.snapshot();
      this.config();
      untracked(() => {
        if (snapshot) {
          this.clockOffset = Date.parse(snapshot.serverTime) - Date.now();
        }
        this.update();
      });
    });
    const timer = setInterval(() => this.update(), SKY_UPDATE_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    this.scene.onFrame((dt) => {
      const falling = [...this.cloudMeshes.values()].filter(({ rain }) => rain);
      if (falling.length === 0) {
        return;
      }
      this.rainTime += dt;
      falling.forEach(({ rain }) => rain!.fall(this.rainTime));
      // Keeps drawing while it rains; the loop rests once it stops.
      this.scene.requestRender();
    });
  }

  /** The server's time now, as near as this device can tell. */
  now(): Date {
    return new Date(Date.now() + this.clockOffset);
  }

  /** The cloud as it is now; undefined for an id the planet does not have. */
  cloud(id: string): SkyCloud | undefined {
    return this.cloudList().find((cloud) => cloud.id === id);
  }

  /** The cloud's mesh; undefined for an id the planet does not have. */
  cloudMesh(id: string): THREE.Mesh | undefined {
    return this.cloudMeshes.get(id)?.mesh;
  }

  /** The rain under the cloud; null while it is dry, or always with reduced motion. */
  rainOf(id: string): THREE.LineSegments | null {
    return this.cloudMeshes.get(id)?.rain?.lines ?? null;
  }

  /** The wet patch on the ground the cloud's rain reaches; null while it is dry. */
  wetPatchOf(id: string): THREE.Mesh | null {
    return this.cloudMeshes.get(id)?.wet ?? null;
  }

  /** Holds the cloud over the point, or moves it there if already held; it stops drifting. */
  holdCloud(id: string, point: SurfacePoint): void {
    this.held.set(id, { lat: point.lat, lon: point.lon });
    this.update();
  }

  /** Lets the cloud drift on where the snapshot says. */
  letGoCloud(id: string): void {
    this.held.delete(id);
    this.update();
  }

  /** Shows rain under the cloud, or stops it. */
  setRaining(id: string, raining: boolean): void {
    if (raining) {
      this.raining.add(id);
    } else {
      this.raining.delete(id);
    }
    this.update();
  }

  /** Puts the sun over the longitude, and the light with it, until letGoSun(). */
  holdSun(angle: number): void {
    this.heldSun = angle;
    this.update();
  }

  /** Lets the sun stand where the snapshot says. */
  letGoSun(): void {
    this.heldSun = null;
    this.update();
  }

  /** Outlines the cloud or the sun, so the keyboard player sees what is selected; null for none. */
  select(target: SkyTarget | null): void {
    this.selected = target;
    this.update();
  }

  /** Moves the clouds and the sun to where they are now, and draws them. */
  update(): void {
    const snapshot = this.store.snapshot();
    const config = this.config();
    const radius = planetRadius(snapshot?.radiusLevel ?? 1);
    const now = this.now();
    const tunables = cloudTunables(config);
    const clouds = (snapshot?.clouds ?? []).map((cloud, i): SkyCloud => {
      const { lat, lon, water } = cloudAt(cloud, now, tunables);
      return { id: cloud.id, name: `Cloud ${i + 1}`, lat, lon, water, ...this.held.get(cloud.id) };
    });
    this.cloudList.set(clouds);
    this.drawClouds(clouds, radius, config.rainRadiusSteps);

    this.angle.set(
      this.heldSun ??
        sunAngleAt(now, config.sunDayMinutes, overrideOf(snapshot?.sun), config.sunOverrideMinutes),
    );
    place(this.sun, { lat: 0, lon: this.angle() }, radius * SUN_DISTANCE, radius * STEP_ARC);
    this.scene.sunLight.position.copy(this.sun.position);

    this.drawOutline();
    this.scene.requestRender();
  }

  private drawClouds(clouds: SkyCloud[], radius: number, rainRadiusSteps: number): void {
    for (const id of this.cloudMeshes.keys()) {
      if (!clouds.some((cloud) => cloud.id === id)) {
        this.removeCloud(id);
      }
    }
    for (const cloud of clouds) {
      const drawn = this.cloudMeshes.get(cloud.id) ?? this.addCloud(cloud.id);
      const look = cloudLook(cloud.water);
      place(drawn.mesh, cloud, radius * CLOUD_HEIGHT, radius * STEP_ARC * look.size);
      drawn.material.opacity = look.opacity;

      const raining = this.raining.has(cloud.id);
      // Seen from above, the streaks fall straight away from the camera; the patch shows where
      // the rain lands, and stays still, so it shows with reduced motion too.
      if (raining && !drawn.wet) {
        drawn.wet = new THREE.Mesh(this.wetGeometry, this.wetMaterial);
        drawn.wet.name = 'wet';
        this.group.add(drawn.wet);
      } else if (!raining && drawn.wet) {
        drawn.wet.removeFromParent();
        drawn.wet = null;
      }
      if (drawn.wet) {
        place(drawn.wet, cloud, radius * WET_HEIGHT, radius * rainRadiusSteps * STEP_ARC);
      }

      // No rain falls while motion is reduced (SET-03).
      const falls = raining && !this.motion.reduced();
      if (falls && !drawn.rain) {
        drawn.rain = new RainStreaks(CLOUD_HEIGHT, rainRadiusSteps * STEP_ARC * RAIN_SPREAD);
        this.group.add(drawn.rain.lines);
      } else if (!falls && drawn.rain) {
        drawn.rain.dispose();
        drawn.rain = null;
      }
      if (drawn.rain) {
        place(drawn.rain.lines, cloud, 0, radius);
      }
    }
  }

  private addCloud(id: string): CloudMesh {
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      transparent: true,
    });
    const mesh = new THREE.Mesh(this.cloudGeometry, material);
    mesh.name = id;
    this.group.add(mesh);
    this.picking.register(mesh, { kind: 'cloud', id });
    const drawn: CloudMesh = { mesh, material, rain: null, wet: null };
    this.cloudMeshes.set(id, drawn);
    return drawn;
  }

  private removeCloud(id: string): void {
    const drawn = this.cloudMeshes.get(id)!;
    drawn.rain?.dispose();
    drawn.wet?.removeFromParent();
    drawn.mesh.removeFromParent();
    drawn.material.dispose();
    this.picking.unregister(drawn.mesh);
    this.cloudMeshes.delete(id);
  }

  private drawOutline(): void {
    const target = this.selected;
    const around =
      target?.kind === 'sun' ? this.sun : target ? this.cloudMesh(target.id) : undefined;
    if (!around) {
      this.outline.removeFromParent();
      return;
    }
    this.outline.geometry = around.geometry;
    around.add(this.outline);
  }
}

/** Stands an object at distance from the planet centre over the point, upright, at a size. */
function place(object: THREE.Object3D, point: SurfacePoint, distance: number, size: number): void {
  const { x, y, z } = toVector(point, 1);
  const direction = new THREE.Vector3(x, y, z);
  object.quaternion.setFromUnitVectors(UP, direction);
  object.position.copy(direction.multiplyScalar(distance));
  object.scale.setScalar(size);
}

/** The player's last drag of the sun, while the snapshot still names one. */
function overrideOf(sun: SunStateDto | undefined): SunOverride | null {
  return sun?.overrideAngle != null && sun.overrideAt
    ? { angle: sun.overrideAngle, at: new Date(sun.overrideAt) }
    : null;
}
