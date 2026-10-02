/*
 * How a plant grows (plan D-10, GRD-04, GRD-05, GRD-06). This file exists
 * twice, in backend/src/simulation and frontend/src/app/core/helpers, and the
 * backend spec fails when the copies differ: change both together. Every line
 * fits both the 80-column backend Prettier and the 100-column frontend one.
 */

/** How a plant's water level feels to it (GRD-04). */
export type WaterStatus = 'thirsty' | 'a-bit-thirsty' | 'happy' | 'soggy';

/** How the light on a plant suits its preference (GRD-04). */
export type LightStatus = 'too-dark' | 'ok' | 'too-sunny';

export type Stage = 'seed' | 'sprout' | 'young' | 'bloom';

export type WaterPref = 'low' | 'medium' | 'high';

export type LightPref = 'shade' | 'partial' | 'full-sun';

/** What a plant type asks for, from its catalogue entry. */
export interface PlantNeeds {
  waterPref: WaterPref;
  lightPref: LightPref;
  /** Minutes from seed to bloom while every need is met. */
  bloomMinutes: number;
}

/** The part of a plant that growing changes. */
export interface GrowthState {
  stage: Stage;
  /** Progress towards bloom, 0..1. */
  growth: number;
  /** 0..1. */
  water: number;
  harvestReady: boolean;
}

export interface GrowthTunables {
  /** Growth speed kept for each unmet need, 0.5 by default (SD section 11). */
  unmetNeedGrowthFactor: number;
}

/**
 * The sunlight on a plant, 0..1, or 'away': while the player is away every
 * plant gets the sun's average, which partly meets every preference and so
 * costs no growth (TIM-01 AC1, AC4).
 */
export type Exposure = number | 'away';

/** A stage reached during one advance, in minutes from its start. */
export interface ReachedStage {
  stage: Stage;
  atMinute: number;
}

export interface GrowthResult {
  state: GrowthState;
  /** In the order they were reached. */
  reachedStages: ReachedStage[];
}

/** The stages in order; a plant only ever moves forward through them. */
export const STAGES: readonly Stage[] = ['seed', 'sprout', 'young', 'bloom'];

/** The growth at which each stage of STAGES begins. */
const STAGE_FROM: readonly number[] = [0, 1 / 3, 2 / 3, 1];

/**
 * Growth summed over many slices lands a hair either side of a stage
 * threshold; this close counts as reached.
 */
const EPSILON = 1e-9;

// thirsty < 0.12 <= a-bit-thirsty < 0.3 <= happy <= 0.85 < soggy
const SOGGY_ABOVE = 0.85;
const HAPPY_FROM = 0.3;
const THIRSTY_BELOW = 0.12;

/** The status of falling water while its level is above a floor. */
interface WaterBand {
  floor: number;
  status: WaterStatus;
}

/** Top down. Below the last floor the water is empty, still thirsty. */
const WATER_BANDS: readonly WaterBand[] = [
  { floor: SOGGY_ABOVE, status: 'soggy' },
  { floor: HAPPY_FROM, status: 'happy' },
  { floor: THIRSTY_BELOW, status: 'a-bit-thirsty' },
  { floor: 0, status: 'thirsty' },
];

/**
 * Water lost per hour. A fresh plant (water 0.5) stays happy for over two
 * hours whatever it likes, so every type can bloom once without rain.
 */
const WATER_DECAY_PER_HOUR: Readonly<Record<WaterPref, number>> = {
  low: 0.03,
  medium: 0.06,
  high: 0.09,
};

/**
 * The exposure each preference is fine with. Below min it is too dark, above
 * max too sunny, so a mushroom in full light is too sunny (GRD-03 AC3).
 */
const LIGHT_OK: Readonly<Record<LightPref, { min: number; max: number }>> = {
  shade: { min: 0, max: 0.3 },
  partial: { min: 0.1, max: 0.8 },
  'full-sun': { min: 0.5, max: 1 },
};

export function waterStatus(water: number): WaterStatus {
  if (water < THIRSTY_BELOW) {
    return 'thirsty';
  }
  if (water < HAPPY_FROM) {
    return 'a-bit-thirsty';
  }
  return water <= SOGGY_ABOVE ? 'happy' : 'soggy';
}

export function lightStatus(pref: LightPref, exposure: Exposure): LightStatus {
  if (exposure === 'away') {
    return 'ok';
  }
  const { min, max } = LIGHT_OK[pref];
  if (exposure < min) {
    return 'too-dark';
  }
  return exposure > max ? 'too-sunny' : 'ok';
}

/**
 * The share of full growth speed: none while thirsty (GRD-04 AC3), and the
 * unmet-need factor once for each other unmet need (AC2, AC4).
 */
export function growthMultiplier(
  water: WaterStatus,
  light: LightStatus,
  tunables: GrowthTunables,
): number {
  if (water === 'thirsty') {
    return 0;
  }
  let multiplier = 1;
  if (water !== 'happy') {
    multiplier *= tunables.unmetNeedGrowthFactor;
  }
  if (light !== 'ok') {
    multiplier *= tunables.unmetNeedGrowthFactor;
  }
  return multiplier;
}

export function waterDecayPerHour(pref: WaterPref): number {
  return WATER_DECAY_PER_HOUR[pref];
}

/** The stage a growth level stands for. A plant may be ahead of it. */
export function stageFor(growth: number): Stage {
  let i = STAGES.length - 1;
  while (i > 0 && growth + EPSILON < STAGE_FROM[i]) {
    i--;
  }
  return STAGES[i];
}

/**
 * Grows a plant for the given minutes under one exposure. Water falls
 * linearly and never below 0. Growth is integrated exactly, one water band at
 * a time, so a plant stops at the very minute it turns thirsty (TIM-01 AC3).
 * The stage never goes back and blooming makes the plant harvest-ready;
 * nothing here ever removes a plant (GRD-05 AC3, GRD-06).
 */
export function advancePlant(
  state: GrowthState,
  needs: PlantNeeds,
  minutes: number,
  exposure: Exposure,
  tunables: GrowthTunables,
): GrowthResult {
  const decay = waterDecayPerHour(needs.waterPref) / 60;
  const light = lightStatus(needs.lightPref, exposure);
  const next = { ...state };
  const reachedStages: ReachedStage[] = [];
  let elapsed = 0;
  let left = minutes;
  while (left > 0) {
    const band = WATER_BANDS.find((b) => next.water > b.floor);
    const status = band ? band.status : 'thirsty';
    // Minutes until the water falls to the floor of its band.
    const toFloor = band ? (next.water - band.floor) / decay : Infinity;
    const span = Math.min(left, toFloor);
    const speed = growthMultiplier(status, light, tunables);
    grow(next, speed / needs.bloomMinutes, span, elapsed, reachedStages);
    if (band) {
      // Landing exactly on the floor starts the next pass in the band below.
      next.water = toFloor <= left ? band.floor : next.water - decay * span;
    }
    elapsed += span;
    left -= span;
  }
  return { state: next, reachedStages };
}

/** Adds span minutes of growth and records each stage passed on the way. */
function grow(
  state: GrowthState,
  perMinute: number,
  span: number,
  start: number,
  reached: ReachedStage[],
): void {
  if (perMinute <= 0) {
    return;
  }
  const before = state.growth;
  const after = before + perMinute * span;
  state.growth = after >= 1 - EPSILON ? 1 : after;
  for (let i = STAGES.indexOf(state.stage) + 1; i < STAGES.length; i++) {
    if (state.growth + EPSILON < STAGE_FROM[i]) {
      break;
    }
    const at = Math.max(0, (STAGE_FROM[i] - before) / perMinute);
    reached.push({ stage: STAGES[i], atMinute: start + Math.min(at, span) });
    state.stage = STAGES[i];
    if (state.stage === 'bloom') {
      state.harvestReady = true;
    }
  }
}
