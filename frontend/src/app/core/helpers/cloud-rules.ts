/*
 * The clouds that drift round a planet and rain on it (plan D-10, GRD-02).
 * This file exists twice, in backend/src/simulation and
 * frontend/src/app/core/helpers, and the backend spec fails when the copies
 * differ: change both together. The 80-column backend Prettier and the
 * 100-column frontend one must both leave it as it is, hence the
 * prettier-ignore on the wrapped signatures.
 */

/**
 * A cloud as stored and served: where it was and how much water it held at
 * the instant at. Where it is later follows from cloudAt.
 */
export interface CloudState {
  id: string;
  /** Surface position in degrees. */
  lat: number;
  lon: number;
  /** 0 (empty) to 1 (full). */
  water: number;
  /** ISO timestamp. */
  at: string;
}

/** Where a cloud is and how much water it holds at some instant. */
export interface CloudPosition {
  lat: number;
  lon: number;
  water: number;
}

export interface CloudTunables {
  /** How far east a cloud drifts each minute. */
  driftDegreesPerMinute: number;
  /** How long an empty cloud takes to fill up again (GRD-02 AC2). */
  refillSeconds: number;
  /** How many seconds of rain a full cloud holds. */
  rainSeconds: number;
}

/** What a spell of rain left: the cloud's water and the seconds it rained. */
export interface Rain {
  water: number;
  rained: number;
}

/**
 * A cloud with less water than this counts as empty: it rests and refills
 * instead of raining (GRD-02 AC2). From 0 that takes a fifth of refillSeconds.
 */
export const MIN_RAIN_WATER = 0.2;

/** The latitudes new clouds start at, in turn. */
const START_LATS = [25, -15, 40, -30, 10, -40];

/** Water below this counts as none, so rounding never leaves a last drop. */
const EMPTY_BELOW = 1e-9;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;

/**
 * Where a cloud is at now, and its water. It drifts east at a steady pace on
 * its latitude and refills evenly up to full (GRD-02 AC2, AC3). A clock set
 * back leaves it where it was.
 */
// prettier-ignore
export function cloudAt(
  cloud: CloudState,
  now: Date,
  t: CloudTunables,
): CloudPosition {
  const ms = Math.max(0, now.getTime() - Date.parse(cloud.at));
  const lon = cloud.lon + (t.driftDegreesPerMinute * ms) / MS_PER_MINUTE;
  const water = cloud.water + ms / (t.refillSeconds * MS_PER_SECOND);
  return { lat: cloud.lat, lon: wrapLon(lon), water: Math.min(1, water) };
}

/**
 * Rains for up to the given seconds from a cloud holding water; a full cloud
 * holds rainSeconds of rain. It rains for less when the cloud runs dry, and
 * not at all from one with no water. Below MIN_RAIN_WATER the rain command
 * does not call it.
 */
// prettier-ignore
export function drainSeconds(
  water: number,
  seconds: number,
  t: CloudTunables,
): Rain {
  const rained = Math.min(seconds, water * t.rainSeconds);
  const left = water - rained / t.rainSeconds;
  return { water: left < EMPTY_BELOW ? 0 : left, rained };
}

/**
 * A new planet's clouds: full, spread evenly round it, and at different
 * latitudes so they do not all drift along one line.
 */
export function initialClouds(count: number, now: Date): CloudState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cloud-${i + 1}`,
    lat: START_LATS[i % START_LATS.length],
    lon: wrapLon((360 * i) / count),
    water: 1,
    at: now.toISOString(),
  }));
}

/** A longitude brought into (-180, 180], the range fromVector returns. */
function wrapLon(lon: number): number {
  return 180 - ((((180 - lon) % 360) + 360) % 360);
}
